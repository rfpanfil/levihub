# arquivo: api/routers/categorias.py
# Rotas de CRUD de categorias do repertório pessoal.

from fastapi import APIRouter, Depends
import libsql_client

from api.database import get_db
from api.models import CategoriaRequest
from api.security import get_current_user

router = APIRouter(prefix="/categorias", tags=["Categorias"])


@router.get("/")
async def get_categorias(
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db),
):
    try:
        result = await client.execute(
            "SELECT id, nome FROM categorias_repertorio WHERE usuario_id = ? ORDER BY nome",
            [current_user["id"]],
        )
        categorias = [{"id": row[0], "nome": row[1]} for row in result.rows]
        return {"categorias": categorias}
    except Exception as e:
        return {"error": str(e)}


@router.post("/")
async def add_categoria(
    req: CategoriaRequest,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db),
):
    try:
        await client.execute(
            "INSERT INTO categorias_repertorio (nome, usuario_id) VALUES (?, ?)",
            [req.nome, current_user["id"]],
        )
        return {"message": "Categoria criada!"}
    except Exception as e:
        return {"error": str(e)}


@router.put("/{cat_id}")
async def update_categoria(
    cat_id: int,
    req: CategoriaRequest,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db),
):
    try:
        # Com a tabela relacional, músicas referenciam categoria por ID.
        # Renomear a categoria aqui atualiza automaticamente todos os vínculos.
        await client.execute(
            "UPDATE categorias_repertorio SET nome = ? WHERE id = ? AND usuario_id = ?",
            [req.nome, cat_id, current_user["id"]],
        )
        return {"message": "Categoria atualizada!"}
    except Exception as e:
        return {"error": str(e)}


@router.delete("/{cat_id}")
async def delete_categoria(
    cat_id: int,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db),
):
    try:
        user_id = current_user["id"]
        # Remove vínculos na tabela associativa (CASCADE manual)
        await client.execute(
            "DELETE FROM musica_categorias WHERE categoria_id = ?", [cat_id]
        )
        await client.execute(
            "DELETE FROM categorias_repertorio WHERE id = ? AND usuario_id = ?",
            [cat_id, user_id],
        )
        return {"message": "Categoria excluída!"}
    except Exception as e:
        return {"error": str(e)}
