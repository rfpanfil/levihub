# arquivo: api/routers/admin.py
# Rotas de administração: gestão de usuários e banco global de músicas e categorias.

from typing import List
from fastapi import APIRouter, Depends, HTTPException
import libsql_client

from api.database import get_db, find_or_create_categoria
from api.models import (
    AdminUpdateUser,
    NovaMusicaGlobalRequest,
    EditaMusicaRequest,
    CategoriaRequest,
)
from api.security import require_admin, get_password_hash

router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    dependencies=[Depends(require_admin)],
)

DEFAULT_GLOBAL_CATEGORIES = [
    "agitadas1",
    "agitadas2",
    "lentas1",
    "lentas2",
    "ceia",
    "infantis",
    "casais",
    "junina",
    "natal",
    "pascoa",
    "missoes",
]


async def _set_categorias_musica_global(
    client: libsql_client.Client,
    musica_id: int,
    categorias: List[str],
) -> None:
    """Limpa e re-insere as categorias globais de uma música em musica_categorias."""
    await client.execute(
        "DELETE FROM musica_categorias WHERE musica_id = ?", [musica_id]
    )
    for cat_nome in categorias:
        cat_nome = cat_nome.strip()
        if not cat_nome:
            continue
        cat_id = await find_or_create_categoria(client, cat_nome, None)
        await client.execute(
            "INSERT OR IGNORE INTO musica_categorias (musica_id, categoria_id) VALUES (?, ?)",
            [musica_id, cat_id],
        )


# =============================================================================
# GESTÃO DE USUÁRIOS
# =============================================================================

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
    if req.is_verified is not None:
        await client.execute(
            "UPDATE usuarios SET is_verified = ? WHERE id = ?",
            [1 if req.is_verified else 0, user_id],
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


# =============================================================================
# REPERTÓRIO GLOBAL (MÚSICAS DO BANCO PADRÃO — usuario_id IS NULL)
# =============================================================================

@router.get("/musicas")
async def admin_get_global_musicas(
    admin: dict = Depends(require_admin),
    client: libsql_client.Client = Depends(get_db),
):
    try:
        result = await client.execute(
            """
            SELECT bb.id, bb.nome_musica, bb.artista, bb.tags, bb.link,
                   COALESCE(NULLIF(GROUP_CONCAT(cr.nome), ''), bb.categoria) as categorias_str,
                   bb.codigo, bb.primeira_linha, bb.tom, bb.primeira_nota, bb.versao_vocal,
                   bb.compasso, bb.bpm, bb.cifra, bb.versao_parecida, bb.tema_central
            FROM biblioteca_busca bb
            LEFT JOIN musica_categorias mc ON bb.id = mc.musica_id
            LEFT JOIN categorias_repertorio cr ON mc.categoria_id = cr.id
            WHERE bb.usuario_id IS NULL
            GROUP BY bb.id
            ORDER BY bb.nome_musica
            """
        )
        musicas = [
            {
                "id": r[0],
                "nome_musica": r[1],
                "artista": r[2] or "",
                "tags": r[3] or "",
                "link": r[4] or "",
                "categorias": [c.strip() for c in r[5].split(",") if c.strip()] if r[5] else [],
                "codigo": r[6] or "",
                "primeira_linha": r[7] or "",
                "tom": r[8] or "",
                "primeira_nota": r[9] or "",
                "versao_vocal": r[10] or "",
                "compasso": r[11] or "",
                "bpm": r[12] or "",
                "cifra": r[13] or "",
                "versao_parecida": r[14] or "",
                "tema_central": r[15] or "",
                "ultimo_planejamento_em": None,
                "ultimo_periodo_nome": None,
            }
            for r in result.rows
        ]
        return {"musicas": musicas}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/musicas")
async def admin_add_global_musica(
    musica: NovaMusicaGlobalRequest,
    admin: dict = Depends(require_admin),
    client: libsql_client.Client = Depends(get_db),
):
    try:
        cat_str = ", ".join([c.strip() for c in musica.categorias if c.strip()])
        res = await client.execute(
            "INSERT INTO biblioteca_busca (nome_musica, artista, tags, link, categoria, codigo, primeira_linha, tom, primeira_nota, versao_vocal, compasso, bpm, cifra, versao_parecida, tema_central, usuario_id) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)",
            [
                musica.nome_musica,
                musica.artista,
                musica.tags,
                musica.link,
                cat_str,
                musica.codigo,
                musica.primeira_linha,
                musica.tom,
                musica.primeira_nota,
                musica.versao_vocal,
                musica.compasso,
                musica.bpm,
                musica.cifra,
                musica.versao_parecida,
                musica.tema_central,
            ],
        )
        musica_id = res.last_insert_rowid
        await _set_categorias_musica_global(client, musica_id, musica.categorias)
        return {"message": "Música adicionada ao repertório global com sucesso!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/musicas/{musica_id}")
async def admin_update_global_musica(
    musica_id: int,
    req: EditaMusicaRequest,
    admin: dict = Depends(require_admin),
    client: libsql_client.Client = Depends(get_db),
):
    try:
        check = await client.execute(
            "SELECT id FROM biblioteca_busca WHERE id = ? AND usuario_id IS NULL",
            [musica_id],
        )
        if not check.rows:
            raise HTTPException(status_code=404, detail="Música global não encontrada.")

        cat_str = ", ".join([c.strip() for c in req.categorias if c.strip()])
        await client.execute(
            "UPDATE biblioteca_busca SET nome_musica = ?, artista = ?, tags = ?, link = ?, categoria = ?, "
            "codigo = ?, primeira_linha = ?, tom = ?, primeira_nota = ?, versao_vocal = ?, compasso = ?, bpm = ?, cifra = ?, versao_parecida = ?, tema_central = ? "
            "WHERE id = ? AND usuario_id IS NULL",
            [
                req.nome_musica,
                req.artista,
                req.tags,
                req.link,
                cat_str,
                req.codigo,
                req.primeira_linha,
                req.tom,
                req.primeira_nota,
                req.versao_vocal,
                req.compasso,
                req.bpm,
                req.cifra,
                req.versao_parecida,
                req.tema_central,
                musica_id,
            ],
        )
        await _set_categorias_musica_global(client, musica_id, req.categorias)
        return {"message": "Música global atualizada com sucesso!"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/musicas/{musica_id}")
async def admin_delete_global_musica(
    musica_id: int,
    admin: dict = Depends(require_admin),
    client: libsql_client.Client = Depends(get_db),
):
    try:
        check = await client.execute(
            "SELECT id FROM biblioteca_busca WHERE id = ? AND usuario_id IS NULL",
            [musica_id],
        )
        if not check.rows:
            raise HTTPException(status_code=404, detail="Música global não encontrada.")

        await client.execute(
            "DELETE FROM musica_categorias WHERE musica_id = ?", [musica_id]
        )
        await client.execute(
            "DELETE FROM biblioteca_busca WHERE id = ? AND usuario_id IS NULL",
            [musica_id],
        )
        return {"message": "Música removida do repertório global!"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# CATEGORIAS DO REPERTÓRIO GLOBAL (usuario_id IS NULL)
# =============================================================================

@router.get("/categorias")
async def admin_get_global_categorias(
    admin: dict = Depends(require_admin),
    client: libsql_client.Client = Depends(get_db),
):
    try:
        result = await client.execute(
            "SELECT id, nome FROM categorias_repertorio WHERE usuario_id IS NULL ORDER BY nome"
        )
        # Se ainda não houver categorias globais cadastradas na tabela, garante as padrões
        if not result.rows:
            for default_cat in DEFAULT_GLOBAL_CATEGORIES:
                await find_or_create_categoria(client, default_cat, None)
            result = await client.execute(
                "SELECT id, nome FROM categorias_repertorio WHERE usuario_id IS NULL ORDER BY nome"
            )
        categorias = [{"id": row[0], "nome": row[1]} for row in result.rows]
        return {"categorias": categorias}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/categorias")
async def admin_add_global_categoria(
    req: CategoriaRequest,
    admin: dict = Depends(require_admin),
    client: libsql_client.Client = Depends(get_db),
):
    try:
        nome_clean = req.nome.strip()
        if not nome_clean:
            raise HTTPException(status_code=400, detail="Nome da categoria é obrigatório.")
        await find_or_create_categoria(client, nome_clean, None)
        return {"message": "Categoria global criada!"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/categorias/{cat_id}")
async def admin_update_global_categoria(
    cat_id: int,
    req: CategoriaRequest,
    admin: dict = Depends(require_admin),
    client: libsql_client.Client = Depends(get_db),
):
    try:
        await client.execute(
            "UPDATE categorias_repertorio SET nome = ? WHERE id = ? AND usuario_id IS NULL",
            [req.nome.strip(), cat_id],
        )
        return {"message": "Categoria global atualizada!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/categorias/{cat_id}")
async def admin_delete_global_categoria(
    cat_id: int,
    admin: dict = Depends(require_admin),
    client: libsql_client.Client = Depends(get_db),
):
    try:
        await client.execute(
            "DELETE FROM musica_categorias WHERE categoria_id = ?", [cat_id]
        )
        await client.execute(
            "DELETE FROM categorias_repertorio WHERE id = ? AND usuario_id IS NULL",
            [cat_id],
        )
        return {"message": "Categoria global excluída!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
