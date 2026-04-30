# arquivo: api/routers/roboto_config.py
#
# Rotas para persistir o contexto de busca do LeviRoboto no Turso.
# Apenas o contexto (última busca e tipo) é salvo no banco —
# o histórico de chat permanece estritamente no localStorage do cliente.

from fastapi import APIRouter, Depends
import libsql_client

from api.database import get_db
from api.models import RobotoContextoRequest
from api.security import get_current_user

router = APIRouter(tags=["Roboto Config"])


@router.get("/roboto/contexto")
async def get_roboto_contexto(
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db),
):
    """Retorna o último contexto de busca do usuário logado."""
    try:
        result = await client.execute(
            "SELECT ultima_busca, tipo_busca FROM roboto_contexto WHERE usuario_id = ?",
            [current_user["id"]],
        )
        if result.rows:
            return {
                "ultima_busca": result.rows[0][0] or "",
                "tipo_busca":   result.rows[0][1] or "palavra",
            }
        # Sem registro: retorna defaults
        return {"ultima_busca": "", "tipo_busca": "palavra"}
    except Exception as e:
        return {"error": str(e)}


@router.put("/roboto/contexto")
async def save_roboto_contexto(
    payload: RobotoContextoRequest,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db),
):
    """
    Upsert do contexto de busca (última busca + tipo).
    Cria se não existe, atualiza se já existe para este usuário.
    """
    try:
        await client.execute(
            """
            INSERT INTO roboto_contexto (usuario_id, ultima_busca, tipo_busca)
            VALUES (?, ?, ?)
            ON CONFLICT(usuario_id) DO UPDATE SET
                ultima_busca = excluded.ultima_busca,
                tipo_busca   = excluded.tipo_busca
            """,
            [current_user["id"], payload.ultima_busca, payload.tipo_busca],
        )
        return {"message": "Contexto salvo com sucesso!"}
    except Exception as e:
        return {"error": str(e)}
