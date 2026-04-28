# arquivo: api/routers/musicas.py
# Rotas de busca, sorteio, repertório personalizado e sugestões.
# Débito #3 resolvido: todas as queries de categoria usam JOIN em musica_categorias.

import random
import difflib
import json
import os

import gspread
from fastapi import APIRouter, Depends
from typing import Optional, List
import libsql_client

from api.database import get_db, find_or_create_categoria
from api.models import NovaMusicaRequest, EditaMusicaRequest, SugestaoRequest
from api.security import get_current_user, get_optional_user

router = APIRouter(prefix="/musicas", tags=["Músicas"])


# =============================================================================
# HELPER: insere categorias na tabela associativa para uma música
# =============================================================================

async def _set_categorias_musica(
    client: libsql_client.Client,
    musica_id: int,
    categorias: List[str],
    usuario_id: Optional[int],
) -> None:
    """Limpa e re-insere as categorias de uma música em musica_categorias."""
    await client.execute(
        "DELETE FROM musica_categorias WHERE musica_id = ?", [musica_id]
    )
    for cat_nome in categorias:
        cat_nome = cat_nome.strip()
        if not cat_nome:
            continue
        cat_id = await find_or_create_categoria(client, cat_nome, usuario_id)
        await client.execute(
            "INSERT OR IGNORE INTO musica_categorias (musica_id, categoria_id) VALUES (?, ?)",
            [musica_id, cat_id],
        )


# =============================================================================
# BUSCA PÚBLICA (visitantes + usuários)
# =============================================================================

@router.get("/buscar")
async def buscar_musicas(
    q: str,
    current_user: Optional[dict] = Depends(get_optional_user),
    client: libsql_client.Client = Depends(get_db),
):
    try:
        if not current_user or current_user["usar_banco_padrao"] == 1:
            result = await client.execute(
                "SELECT nome_musica, tags, link FROM biblioteca_busca WHERE usuario_id IS NULL"
            )
        else:
            result = await client.execute(
                "SELECT nome_musica, tags, link FROM biblioteca_busca WHERE usuario_id = ?",
                [current_user["id"]],
            )

        q_lower = q.lower().strip()
        todas_tags = set()
        for row in result.rows:
            tags = [t.strip().lower() for t in row[1].split(",") if t.strip()]
            todas_tags.update(tags)

        closest_word = q_lower
        matches = difflib.get_close_matches(q_lower, list(todas_tags), n=1, cutoff=0.6)
        if matches:
            closest_word = matches[0]

        musicas_encontradas = []
        for row in result.rows:
            nome, tags_str, link = row[0], row[1], row[2]
            tags = [t.strip().lower() for t in tags_str.split(",")]
            if closest_word in tags or closest_word in nome.lower():
                resultado_str = f"{nome}: {link}" if link else nome
                musicas_encontradas.append(resultado_str)

        random.shuffle(musicas_encontradas)
        return {"closest_word": closest_word, "resultados": musicas_encontradas[:10]}
    except Exception as e:
        return {"error": str(e)}


@router.get("/buscar_artista")
async def buscar_artista(
    q: str,
    current_user: Optional[dict] = Depends(get_optional_user),
    client: libsql_client.Client = Depends(get_db),
):
    try:
        if not current_user or current_user["usar_banco_padrao"] == 1:
            result = await client.execute(
                "SELECT nome_musica, artista, link FROM biblioteca_busca "
                "WHERE usuario_id IS NULL AND artista IS NOT NULL AND artista != ''"
            )
        else:
            result = await client.execute(
                "SELECT nome_musica, artista, link FROM biblioteca_busca "
                "WHERE usuario_id = ? AND artista IS NOT NULL AND artista != ''",
                [current_user["id"]],
            )

        q_lower = q.lower().strip()
        todos_artistas = {row[1].strip().lower() for row in result.rows}
        closest_word = q_lower
        matches = difflib.get_close_matches(q_lower, list(todos_artistas), n=1, cutoff=0.5)
        if matches:
            closest_word = matches[0]

        musicas_encontradas = []
        for row in result.rows:
            nome, artista, link = row[0], row[1], row[2]
            if closest_word in artista.lower() or q_lower in artista.lower():
                resultado_str = f"{nome} ({artista})"
                if link:
                    resultado_str += f": {link}"
                musicas_encontradas.append(resultado_str)

        random.shuffle(musicas_encontradas)
        return {"closest_word": closest_word, "resultados": musicas_encontradas[:10]}
    except Exception as e:
        return {"error": str(e)}


@router.get("/buscar_categoria")
async def buscar_categoria(
    q: str,
    current_user: Optional[dict] = Depends(get_optional_user),
    client: libsql_client.Client = Depends(get_db),
):
    """
    Busca músicas por categoria usando JOIN — sem LIKE com falsos positivos.
    """
    try:
        q_lower = q.lower().strip()

        # Busca categorias próximas para melhorar a UX (typos, abreviações)
        if not current_user or current_user["usar_banco_padrao"] == 1:
            cats_res = await client.execute(
                "SELECT DISTINCT cr.nome FROM categorias_repertorio cr "
                "INNER JOIN musica_categorias mc ON cr.id = mc.categoria_id "
                "INNER JOIN biblioteca_busca bb ON mc.musica_id = bb.id "
                "WHERE bb.usuario_id IS NULL"
            )
        else:
            cats_res = await client.execute(
                "SELECT DISTINCT cr.nome FROM categorias_repertorio cr "
                "INNER JOIN musica_categorias mc ON cr.id = mc.categoria_id "
                "INNER JOIN biblioteca_busca bb ON mc.musica_id = bb.id "
                "WHERE bb.usuario_id = ?",
                [current_user["id"]],
            )

        nomes_cats = [row[0].lower() for row in cats_res.rows]
        closest = q_lower
        matches = difflib.get_close_matches(q_lower, nomes_cats, n=1, cutoff=0.6)
        if matches:
            closest = matches[0]

        # Query com JOIN para busca precisa por categoria
        if not current_user or current_user["usar_banco_padrao"] == 1:
            result = await client.execute(
                """
                SELECT DISTINCT bb.nome_musica, bb.link
                FROM biblioteca_busca bb
                INNER JOIN musica_categorias mc ON bb.id = mc.musica_id
                INNER JOIN categorias_repertorio cr ON mc.categoria_id = cr.id
                WHERE LOWER(cr.nome) = ? AND bb.usuario_id IS NULL
                """,
                [closest],
            )
        else:
            result = await client.execute(
                """
                SELECT DISTINCT bb.nome_musica, bb.link
                FROM biblioteca_busca bb
                INNER JOIN musica_categorias mc ON bb.id = mc.musica_id
                INNER JOIN categorias_repertorio cr ON mc.categoria_id = cr.id
                WHERE LOWER(cr.nome) = ? AND bb.usuario_id = ?
                """,
                [closest, current_user["id"]],
            )

        musicas_encontradas = []
        for row in result.rows:
            nome, link = row[0], row[1]
            resultado_str = f"{nome}: {link}" if link else nome
            musicas_encontradas.append(resultado_str)

        random.shuffle(musicas_encontradas)
        return {"closest_word": closest, "resultados": musicas_encontradas[:10]}
    except Exception as e:
        return {"error": str(e)}


@router.get("/sortear")
async def sortear_musica(
    current_user: Optional[dict] = Depends(get_optional_user),
    client: libsql_client.Client = Depends(get_db),
):
    try:
        if not current_user or current_user["usar_banco_padrao"] == 1:
            # Sorteia uma música aleatória por categoria no banco global via JOIN
            async def pegar_aleatoria(categoria_nome: str) -> str:
                try:
                    res = await client.execute(
                        """
                        SELECT bb.nome_musica, bb.link
                        FROM biblioteca_busca bb
                        INNER JOIN musica_categorias mc ON bb.id = mc.musica_id
                        INNER JOIN categorias_repertorio cr ON mc.categoria_id = cr.id
                        WHERE bb.usuario_id IS NULL AND LOWER(cr.nome) = LOWER(?)
                        ORDER BY RANDOM() LIMIT 1
                        """,
                        [categoria_nome],
                    )
                    if res.rows:
                        nome, link = res.rows[0][0], res.rows[0][1]
                        return f"{nome}: {link}" if link else nome
                    return "Nenhuma música cadastrada."
                except Exception:
                    return "Erro ao buscar."

            return {
                "is_custom": False,
                "agitadas1": await pegar_aleatoria("agitadas1"),
                "agitadas2": await pegar_aleatoria("agitadas2"),
                "lentas1": await pegar_aleatoria("lentas1"),
                "lentas2": await pegar_aleatoria("lentas2"),
                "ceia": await pegar_aleatoria("ceia"),
                "infantis": await pegar_aleatoria("infantis"),
                "natal": await pegar_aleatoria("natal"),
                "junina": await pegar_aleatoria("junina"),
                "casais": await pegar_aleatoria("casais"),
                "pascoa": await pegar_aleatoria("pascoa"),
                "missoes": await pegar_aleatoria("missoes"),
            }

        # Repertório pessoal
        user_id = current_user["id"]
        res_cats = await client.execute(
            "SELECT nome FROM categorias_repertorio WHERE usuario_id = ?", [user_id]
        )
        categorias = [row[0].lower() for row in res_cats.rows if row[0].strip()]

        sorteio = {}
        for cat in categorias:
            res_musica = await client.execute(
                """
                SELECT bb.nome_musica, bb.link
                FROM biblioteca_busca bb
                INNER JOIN musica_categorias mc ON bb.id = mc.musica_id
                INNER JOIN categorias_repertorio cr ON mc.categoria_id = cr.id
                WHERE bb.usuario_id = ? AND LOWER(cr.nome) = LOWER(?)
                ORDER BY RANDOM() LIMIT 1
                """,
                [user_id, cat],
            )
            if res_musica.rows:
                nome, link = res_musica.rows[0][0], res_musica.rows[0][1]
                sorteio[cat] = f"{nome}: {link}" if link else nome

        return {"is_custom": True, "sorteio": sorteio}
    except Exception as e:
        return {"error": str(e)}


# =============================================================================
# REPERTÓRIO PERSONALIZADO (autenticado)
# =============================================================================

@router.get("/custom")
async def get_custom_musicas(
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db),
):
    try:
        result = await client.execute(
            """
            SELECT bb.id, bb.nome_musica, bb.artista, bb.tags, bb.link,
                   GROUP_CONCAT(cr.nome) as categorias_str
            FROM biblioteca_busca bb
            LEFT JOIN musica_categorias mc ON bb.id = mc.musica_id
            LEFT JOIN categorias_repertorio cr ON mc.categoria_id = cr.id
            WHERE bb.usuario_id = ?
            GROUP BY bb.id
            ORDER BY bb.nome_musica
            """,
            [current_user["id"]],
        )
        musicas = [
            {
                "id": r[0],
                "nome_musica": r[1],
                "artista": r[2] or "",
                "tags": r[3],
                "link": r[4] or "",
                "categorias": r[5].split(",") if r[5] else [],
            }
            for r in result.rows
        ]
        return {"musicas": musicas}
    except Exception as e:
        return {"error": str(e)}


@router.post("/custom")
async def add_custom_musica(
    musica: NovaMusicaRequest,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db),
):
    try:
        res = await client.execute(
            "INSERT INTO biblioteca_busca (nome_musica, artista, tags, usuario_id, link) "
            "VALUES (?, ?, ?, ?, ?)",
            [musica.nome_musica, musica.artista, musica.tags, current_user["id"], musica.link],
        )
        musica_id = res.last_insert_rowid
        await _set_categorias_musica(client, musica_id, musica.categorias, current_user["id"])
        return {"message": "Música adicionada ao seu repertório!"}
    except Exception as e:
        return {"error": str(e)}


@router.put("/custom/{musica_id}")
async def update_custom_musica(
    musica_id: int,
    req: EditaMusicaRequest,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db),
):
    try:
        await client.execute(
            "UPDATE biblioteca_busca SET nome_musica = ?, artista = ?, tags = ?, link = ? "
            "WHERE id = ? AND usuario_id = ?",
            [req.nome_musica, req.artista, req.tags, req.link, musica_id, current_user["id"]],
        )
        await _set_categorias_musica(client, musica_id, req.categorias, current_user["id"])
        return {"message": "Música atualizada!"}
    except Exception as e:
        return {"error": str(e)}


@router.delete("/custom/{musica_id}")
async def delete_custom_musica(
    musica_id: int,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db),
):
    try:
        await client.execute(
            "DELETE FROM musica_categorias WHERE musica_id = ?", [musica_id]
        )
        await client.execute(
            "DELETE FROM biblioteca_busca WHERE id = ? AND usuario_id = ?",
            [musica_id, current_user["id"]],
        )
        return {"message": "Música removida!"}
    except Exception as e:
        return {"error": str(e)}


# =============================================================================
# SUGESTÕES (Google Sheets)
# =============================================================================

@router.post("/sugerir")
async def sugerir_musica(req: SugestaoRequest):
    try:
        google_creds_env = os.getenv("GOOGLE_CREDENTIALS")
        if google_creds_env:
            creds_dict = json.loads(google_creds_env)
            gc = gspread.service_account_from_dict(creds_dict)
        else:
            gc = gspread.service_account(filename="credentials.json")
        sh = gc.open("Sugestões de músicas LeviRoboto")
        sh.sheet1.append_row([req.usuario, req.sugestao])
        return {"message": "Sucesso"}
    except Exception as e:
        return {"error": str(e)}
