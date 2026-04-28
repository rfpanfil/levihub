# arquivo: api/routers/admin.py
# Rotas de administração: gestão de usuários e banco global de músicas.

from fastapi import APIRouter, Depends
import libsql_client

from api.database import get_db, find_or_create_categoria
from api.models import AdminUpdateUser, NovaMusicaGlobalRequest
from api.security import require_admin, get_password_hash

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/usuarios")
async def admin_get_users(
    admin: dict = Depends(require_admin),
    client: libsql_client.Client = Depends(get_db),
):
    res = await client.execute(
        "SELECT id, email, role, is_verified FROM usuarios ORDER BY id"
    )
    users = [
        {"id": r[0], "email": r[1], "role": r[2] or "user", "is_verified": bool(r[3])}
        for r in res.rows
    ]
    return {"usuarios": users}


@router.put("/usuarios/{user_id}")
async def admin_update_user(
    user_id: int,
    req: AdminUpdateUser,
    admin: dict = Depends(require_admin),
    client: libsql_client.Client = Depends(get_db),
):
    if req.email:
        await client.execute(
            "UPDATE usuarios SET email = ? WHERE id = ?", [req.email, user_id]
        )
    if req.senha:
        hashed = get_password_hash(req.senha)
        await client.execute(
            "UPDATE usuarios SET senha = ? WHERE id = ?", [hashed, user_id]
        )
    if req.role:
        await client.execute(
            "UPDATE usuarios SET role = ? WHERE id = ?", [req.role, user_id]
        )
    return {"message": "Usuário atualizado pelo Administrador."}


@router.delete("/usuarios/{user_id}")
async def admin_delete_user(
    user_id: int,
    admin: dict = Depends(require_admin),
    client: libsql_client.Client = Depends(get_db),
):
    await client.execute("DELETE FROM usuarios WHERE id = ?", [user_id])
    return {"message": "Usuário excluído do sistema."}


@router.post("/musicas")
async def admin_add_global_musica(
    musica: NovaMusicaGlobalRequest,
    admin: dict = Depends(require_admin),
    client: libsql_client.Client = Depends(get_db),
):
    try:
        res = await client.execute(
            "INSERT INTO biblioteca_busca (nome_musica, artista, tags, link, usuario_id) "
            "VALUES (?, ?, ?, ?, NULL)",
            [musica.nome_musica, musica.artista, musica.tags, musica.link],
        )
        musica_id = res.last_insert_rowid
        # Insere cada categoria na tabela associativa (usuario_id=None = global)
        for cat_nome in musica.categorias:
            cat_nome = cat_nome.strip()
            if not cat_nome:
                continue
            cat_id = await find_or_create_categoria(client, cat_nome, None)
            await client.execute(
                "INSERT OR IGNORE INTO musica_categorias (musica_id, categoria_id) VALUES (?, ?)",
                [musica_id, cat_id],
            )
        return {"message": "Música adicionada ao repertório global com sucesso!"}
    except Exception as e:
        return {"error": str(e)}
