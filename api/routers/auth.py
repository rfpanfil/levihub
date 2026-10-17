# arquivo: api/routers/auth.py
# Rotas de autenticação: registro, verificação de e-mail, login e recuperação de senha.

import random
import string
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response, Request
import libsql_client

import requests
import resend
from api.limiter import limiter
from api.config import (
    ACCESS_TOKEN_EXPIRE_MINUTES, SMTP_EMAIL, SMTP_PASSWORD,
    IS_PRODUCTION, RESEND_API_KEY, GOOGLE_SCRIPT_EMAIL_URL,
)
from api.database import get_db
from api.models import (
    UserCreate, Token, VerifyRequest,
    ForgotPasswordRequest, ResetPasswordRequest,
)
from api.security import (
    get_password_hash, verify_password, create_access_token,
)
from fastapi.security import OAuth2PasswordRequestForm

router = APIRouter(prefix="/auth", tags=["Autenticação"])


# =============================================================================
# FUNÇÕES AUXILIARES DE E-MAIL
# =============================================================================

def _disparar_email(destinatario: str, assunto: str, corpo_texto: str, corpo_html: str) -> None:
    """
    Ordem de tentativa de envio:
    1. Google Apps Script Webhook (HTTPS) -> Contorna bloqueio SMTP do Render e envia para qualquer destinatário via Gmail.
    2. Resend API (HTTPS) -> Envia via Resend (requer domínio próprio para destinatários externos).
    3. SMTP Gmail (Porta 465) -> Funciona em desenvolvimento local / Docker.
    """
    # 1. Tenta via Google Apps Script Webhook (Recomendado para Render sem domínio próprio)
    if GOOGLE_SCRIPT_EMAIL_URL:
        try:
            resp = requests.post(
                GOOGLE_SCRIPT_EMAIL_URL,
                json={
                    "to": destinatario,
                    "subject": assunto,
                    "body": corpo_texto,
                    "htmlBody": corpo_html,
                },
                timeout=15,
            )
            if resp.status_code == 200:
                print(f"E-mail enviado via Google Apps Script para {destinatario}")
                return
            print(f"Aviso Google Apps Script (status {resp.status_code}): {resp.text}")
        except Exception as e:
            print(f"Erro ao enviar e-mail via Google Apps Script: {e}")

    # 2. Tenta via RESEND
    if RESEND_API_KEY:
        resend.api_key = RESEND_API_KEY
        try:
            r = resend.Emails.send({
                "from": "LeviHub <onboarding@resend.dev>",
                "to": destinatario,
                "subject": assunto,
                "html": corpo_html,
            })
            print(f"E-mail enviado via Resend para {destinatario}: {r}")
            return
        except Exception as e:
            print(f"Erro ao enviar e-mail (Resend): {e}")

    # 3. Fallback para SMTP Gmail (Desenvolvimento Local)
    if SMTP_EMAIL and SMTP_PASSWORD:
        msg = MIMEMultipart()
        msg["From"] = SMTP_EMAIL
        msg["To"] = destinatario
        msg["Subject"] = assunto
        msg.attach(MIMEText(corpo_texto, "plain"))
        try:
            with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ssl.create_default_context(), timeout=15) as server:
                server.login(SMTP_EMAIL, SMTP_PASSWORD)
                server.sendmail(SMTP_EMAIL, destinatario, msg.as_string())
            print(f"E-mail enviado via SMTP para {destinatario}")
            return
        except Exception as e:
            print(f"Erro ao enviar e-mail via SMTP: {e}")

    print(f"AVISO: Nenhum provedor de e-mail conseguiu entregar a mensagem para {destinatario}.")


def enviar_email_verificacao(destinatario: str, codigo: str) -> None:
    assunto = "Verifique a sua conta no LeviHub 🎸"
    corpo_texto = (
        f"Olá Abençoado(a)!\n\n"
        f"Bem-vindo ao LeviHub! O seu código de verificação é:\n\n"
        f"{codigo}\n\n"
        f"Insira este código na tela de cadastro para ativar a sua conta.\n\n"
        f"Deus abençoe!"
    )
    corpo_html = (
        f"<p>Olá Abençoado(a)!</p>"
        f"<p>Bem-vindo ao <b>LeviHub</b>! O seu código de verificação é:</p>"
        f"<h2>{codigo}</h2>"
        f"<p>Insira este código na tela de cadastro para ativar a sua conta.</p>"
        f"<p>Deus abençoe!</p>"
    )
    _disparar_email(destinatario, assunto, corpo_texto, corpo_html)


def enviar_email_recuperacao(destinatario: str, codigo: str) -> None:
    assunto = "Recuperação de Senha - LeviHub 🎸"
    corpo_texto = (
        f"Você solicitou a recuperação de senha. Seu código é:\n\n"
        f"{codigo}\n\n"
        f"Se não foi você, ignore este e-mail."
    )
    corpo_html = (
        f"<p>Você solicitou a recuperação de senha. Seu código é:</p>"
        f"<h2>{codigo}</h2>"
        f"<p>Se não foi você, ignore este e-mail.</p>"
    )
    _disparar_email(destinatario, assunto, corpo_texto, corpo_html)


# =============================================================================
# ROTAS
# =============================================================================

@router.post("/register")
async def register_user(
    user: UserCreate,
    background_tasks: BackgroundTasks,
    client: libsql_client.Client = Depends(get_db),
):
    check = await client.execute(
        "SELECT id, is_verified FROM usuarios WHERE email = ?", [user.email]
    )

    if check.rows:
        user_id = check.rows[0][0]
        is_verified = check.rows[0][1]

        if is_verified:
            raise HTTPException(
                status_code=400,
                detail="Este e-mail já está cadastrado. Por favor, faça login.",
            )
        # Conta existe mas não foi verificada: atualiza senha e reenvia código
        hashed_pwd = get_password_hash(user.password)
        codigo = "".join(random.choices(string.digits, k=6))
        await client.execute(
            "UPDATE usuarios SET senha = ?, verification_code = ? WHERE id = ?",
            [hashed_pwd, codigo, user_id],
        )
        background_tasks.add_task(enviar_email_verificacao, user.email, codigo)
        return {
            "message": "Conta pendente encontrada. Novo código de verificação enviado!",
            "email": user.email,
        }

    # Conta nova
    hashed_pwd = get_password_hash(user.password)
    codigo = "".join(random.choices(string.digits, k=6))
    await client.execute(
        "INSERT INTO usuarios (email, senha, usar_banco_padrao, is_verified, verification_code) VALUES (?, ?, 1, 0, ?)",
        [user.email, hashed_pwd, codigo],
    )
    background_tasks.add_task(enviar_email_verificacao, user.email, codigo)
    return {"message": "Usuário criado. Verifique o seu e-mail.", "email": user.email}


@router.post("/verify")
async def verify_email(
    req: VerifyRequest,
    client: libsql_client.Client = Depends(get_db),
):
    res = await client.execute(
        "SELECT id, verification_code FROM usuarios WHERE email = ?", [req.email]
    )
    if not res.rows:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    user_id = res.rows[0][0]
    code_db = res.rows[0][1]

    if code_db != req.codigo.strip():
        raise HTTPException(status_code=400, detail="Código inválido ou expirado.")

    await client.execute(
        "UPDATE usuarios SET is_verified = 1, verification_code = NULL WHERE id = ?",
        [user_id],
    )
    return {"message": "Email verificado com sucesso! Já pode fazer o login."}


@router.post("/login", response_model=Token, dependencies=[])
@limiter.limit("5/minute")
async def login_for_access_token(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    client: libsql_client.Client = Depends(get_db),
):
    result = await client.execute(
        "SELECT id, senha, is_verified FROM usuarios WHERE email = ?",
        [form_data.username],
    )
    if not result.rows:
        raise HTTPException(status_code=401, detail="Email ou senha incorretos")

    user_db = result.rows[0]
    user_id, hashed_pwd, is_verified = user_db[0], user_db[1], user_db[2]

    if not verify_password(form_data.password, hashed_pwd):
        raise HTTPException(status_code=401, detail="Email ou senha incorretos")

    if not is_verified:
        raise HTTPException(
            status_code=403,
            detail="E-mail não verificado. Procure o código na sua caixa de entrada.",
        )

    access_token = create_access_token(
        data={"sub": str(user_id)},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout", dependencies=[])
async def logout(response: Response):
    response.delete_cookie(
        key="access_token",
        httponly=True,
        secure=True,
        samesite="none"
    )
    return {"message": "Logout realizado com sucesso"}


@router.post("/forgot-password", dependencies=[])
async def forgot_password(
    req: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    client: libsql_client.Client = Depends(get_db),
):
    res = await client.execute(
        "SELECT id FROM usuarios WHERE email = ?", [req.email]
    )
    if not res.rows:
        # Por segurança, não confirmamos se o e-mail existe
        return {"message": "Se o e-mail estiver cadastrado, um código será enviado."}

    user_id = res.rows[0][0]
    codigo = "".join(random.choices(string.digits, k=6))

    # Escreve APENAS em token_recuperacao — sem tocar em verification_code
    await client.execute(
        "UPDATE usuarios SET token_recuperacao = ? WHERE id = ?", [codigo, user_id]
    )
    background_tasks.add_task(enviar_email_recuperacao, req.email, codigo)
    return {"message": "Código de recuperação enviado!"}


@router.post("/reset-password", dependencies=[])
async def reset_password(
    req: ResetPasswordRequest,
    client: libsql_client.Client = Depends(get_db),
):
    # Lê token_recuperacao — coluna exclusiva do fluxo de recuperação
    res = await client.execute(
        "SELECT id, token_recuperacao FROM usuarios WHERE email = ?", [req.email]
    )
    if not res.rows:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    user_id = res.rows[0][0]
    token_db = res.rows[0][1]

    if not token_db or token_db != req.codigo.strip():
        raise HTTPException(status_code=400, detail="Código inválido ou expirado.")

    hashed_pwd = get_password_hash(req.nova_senha)
    # Limpa token_recuperacao após uso bem-sucedido
    await client.execute(
        "UPDATE usuarios SET senha = ?, token_recuperacao = NULL WHERE id = ?",
        [hashed_pwd, user_id],
    )
    return {"message": "Senha alterada com sucesso!"}
