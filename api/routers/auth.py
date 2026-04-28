# arquivo: api/routers/auth.py
# Rotas de autenticação: registro, verificação de e-mail, login e recuperação de senha.

import random
import string
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
import libsql_client

from api.config import ACCESS_TOKEN_EXPIRE_MINUTES, SMTP_EMAIL, SMTP_PASSWORD
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

# SSL: usa o contexto padrão seguro do sistema (verificação de certificado habilitada)


def enviar_email_verificacao(destinatario: str, codigo: str) -> None:
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        print(f"AVISO: SMTP não configurado. Código para {destinatario}: {codigo}")
        return

    msg = MIMEMultipart()
    msg["From"] = SMTP_EMAIL
    msg["To"] = destinatario
    msg["Subject"] = "Verifique a sua conta no LeviHub 🎸"
    body = (
        f"Olá Abençoado(a)!\n\n"
        f"Bem-vindo ao LeviHub! O seu código de verificação é:\n\n"
        f"{codigo}\n\n"
        f"Insira este código na tela de cadastro para ativar a sua conta.\n\n"
        f"Deus abençoe!"
    )
    msg.attach(MIMEText(body, "plain"))
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ssl.create_default_context()) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, destinatario, msg.as_string())
            print(f"E-mail de verificação enviado para {destinatario}")
    except Exception as e:
        print(f"Erro ao enviar e-mail: {e}")


def enviar_email_recuperacao(destinatario: str, codigo: str) -> None:
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        return

    msg = MIMEMultipart()
    msg["From"] = SMTP_EMAIL
    msg["To"] = destinatario
    msg["Subject"] = "Recuperação de Senha - LeviHub 🎸"
    body = (
        f"Você solicitou a recuperação de senha. Seu código é:\n\n"
        f"{codigo}\n\n"
        f"Se não foi você, ignore este e-mail."
    )
    msg.attach(MIMEText(body, "plain"))
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ssl.create_default_context()) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, destinatario, msg.as_string())
    except Exception as e:
        print(f"Erro ao enviar e-mail de recuperação: {e}")


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


@router.post("/login", response_model=Token)
async def login_for_access_token(
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
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/forgot-password")
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
    await client.execute(
        "UPDATE usuarios SET verification_code = ? WHERE id = ?", [codigo, user_id]
    )
    background_tasks.add_task(enviar_email_recuperacao, req.email, codigo)
    return {"message": "Código de recuperação enviado!"}


@router.post("/reset-password")
async def reset_password(
    req: ResetPasswordRequest,
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

    hashed_pwd = get_password_hash(req.nova_senha)
    await client.execute(
        "UPDATE usuarios SET senha = ?, verification_code = NULL WHERE id = ?",
        [hashed_pwd, user_id],
    )
    return {"message": "Senha alterada com sucesso!"}
