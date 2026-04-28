# arquivo: api/routers/usuario.py
# Rotas de perfil e configuração do usuário logado.

from fastapi import APIRouter, Depends, HTTPException
import libsql_client

from api.database import get_db
from api.models import ConfigRequest, UpdateCredentialsRequest
from api.security import get_current_user, get_password_hash

router = APIRouter(prefix="/usuario", tags=["Usuário"])


@router.get("/me")
async def get_my_profile(
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db),
):
    try:
        res = await client.execute(
            "SELECT funcoes_padrao FROM usuarios WHERE id = ?", [current_user["id"]]
        )
        padrao = (
            res.rows[0][0]
            if res.rows and res.rows[0][0]
            else "Mídia,Voz e violão,Voz 1,Voz 2,Voz 3"
        )
        return {
            "email": current_user["email"],
            "usar_banco_padrao": bool(current_user["usar_banco_padrao"]),
            "funcoes_padrao": padrao,
            "role": current_user.get("role", "user"),
        }
    except Exception as e:
        return {"error": str(e)}


@router.put("/config")
async def update_config(
    config: ConfigRequest,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db),
):
    try:
        if config.usar_banco_padrao is not None:
            val = 1 if config.usar_banco_padrao else 0
            await client.execute(
                "UPDATE usuarios SET usar_banco_padrao = ? WHERE id = ?",
                [val, current_user["id"]],
            )
        if config.funcoes_padrao is not None:
            await client.execute(
                "UPDATE usuarios SET funcoes_padrao = ? WHERE id = ?",
                [config.funcoes_padrao, current_user["id"]],
            )
        return {"message": "Configuração atualizada!"}
    except Exception as e:
        return {"error": str(e)}


@router.put("/credenciais")
async def update_my_credentials(
    req: UpdateCredentialsRequest,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db),
):
    if req.novo_email:
        check = await client.execute(
            "SELECT id FROM usuarios WHERE email = ? AND id != ?",
            [req.novo_email, current_user["id"]],
        )
        if check.rows:
            raise HTTPException(
                status_code=400, detail="Este e-mail já está em uso por outra conta."
            )
        await client.execute(
            "UPDATE usuarios SET email = ? WHERE id = ?",
            [req.novo_email, current_user["id"]],
        )
    if req.nova_senha:
        hashed = get_password_hash(req.nova_senha)
        await client.execute(
            "UPDATE usuarios SET senha = ? WHERE id = ?",
            [hashed, current_user["id"]],
        )
    return {"message": "Credenciais atualizadas com sucesso!"}
