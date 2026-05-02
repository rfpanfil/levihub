# arquivo: api/security.py
#
# Funções de segurança: hashing de senhas, JWT e dependencies de autenticação.
# Centraliza tudo que antes estava espalhado no topo de api.py.

import bcrypt
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
import libsql_client

from api.config import SECRET_KEY, ALGORITHM
from api.database import get_db

# --- Schemes OAuth2 ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


# =============================================================================
# HASHING DE SENHAS
# =============================================================================

def get_password_hash(password: str) -> str:
    """Gera o hash bcrypt de uma senha em texto puro."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica se uma senha em texto puro corresponde ao hash armazenado."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception:
        return False


# =============================================================================
# JWT
# =============================================================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Cria um token JWT assinado com os dados fornecidos."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta if expires_delta else timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# =============================================================================
# DEPENDENCIES DE AUTENTICAÇÃO
# =============================================================================

async def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    client: libsql_client.Client = Depends(get_db),
) -> dict:
    """
    Dependency obrigatória. Valida o JWT vindo do Cookie HttpOnly e retorna o usuário logado.
    Lança HTTP 401 se o token for inválido ou o usuário não existir.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não foi possível validar as credenciais",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not token:
        token = request.cookies.get("access_token")
    
    if not token:
        raise credentials_exception
    else:
        # FastAPI/Starlette pode colocar o valor do cookie entre aspas.
        token = token.strip('"')
        if token.startswith("Bearer "):
            token = token.split(" ", 1)[1]

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await client.execute(
        "SELECT id, email, usar_banco_padrao, role FROM usuarios WHERE id = ?",
        [user_id],
    )
    if not result.rows:
        raise credentials_exception

    user = result.rows[0]
    return {
        "id": user[0],
        "email": user[1],
        "usar_banco_padrao": user[2],
        "role": user[3] if len(user) > 3 and user[3] else "user",
    }


async def get_optional_user(
    request: Request,
    token: str = Depends(oauth2_scheme_optional),
    client: libsql_client.Client = Depends(get_db),
) -> Optional[dict]:
    """
    Dependency opcional. Retorna o usuário logado se o cookie/token for válido,
    ou None se não houver (modo visitante). Não lança exceção.
    """
    if not token:
        token = request.cookies.get("access_token")
    
    if not token:
        return None
    else:
        token = token.strip('"')
        if token.startswith("Bearer "):
            token = token.split(" ", 1)[1]

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        result = await client.execute(
            "SELECT id, email, usar_banco_padrao FROM usuarios WHERE id = ?",
            [user_id],
        )
        if not result.rows:
            return None
        user = result.rows[0]
        return {"id": user[0], "email": user[1], "usar_banco_padrao": user[2]}
    except Exception:
        return None


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Dependency de autorização. Só permite acesso a usuários com role='admin'.
    Lança HTTP 403 caso contrário.
    """
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Acesso negado. Área restrita a Administradores.",
        )
    return current_user
