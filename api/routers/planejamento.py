# arquivo: api/routers/planejamento.py
from fastapi import APIRouter, Depends
import libsql_client
from typing import List, Optional
from pydantic import BaseModel

from api.database import get_db
from api.security import get_current_user
from api.models import PeriodoCreateRequest, PeriodoUpdateRequest, PeriodoAdicionarMusicaRequest

router = APIRouter(prefix="/planejamento", tags=["Planejamento"])

@router.get("/")
async def listar_periodos(
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db)
):
    try:
        res = await client.execute(
            "SELECT id, nome FROM planejamento_periodos WHERE usuario_id = ? ORDER BY id DESC",
            [current_user["id"]]
        )
        periodos = [{"id": r[0], "nome": r[1]} for r in res.rows]
        return {"periodos": periodos}
    except Exception as e:
        return {"error": str(e)}

@router.post("/")
async def criar_periodo(
    req: PeriodoCreateRequest,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db)
):
    try:
        res = await client.execute(
            "INSERT INTO planejamento_periodos (usuario_id, nome) VALUES (?, ?)",
            [current_user["id"], req.nome]
        )
        return {"message": "Período criado com sucesso!", "id": res.last_insert_rowid}
    except Exception as e:
        return {"error": str(e)}

@router.put("/{periodo_id}")
async def editar_periodo(
    periodo_id: int,
    req: PeriodoUpdateRequest,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db)
):
    try:
        await client.execute(
            "UPDATE planejamento_periodos SET nome = ? WHERE id = ? AND usuario_id = ?",
            [req.nome, periodo_id, current_user["id"]]
        )
        return {"message": "Período atualizado!"}
    except Exception as e:
        return {"error": str(e)}

@router.delete("/{periodo_id}")
async def deletar_periodo(
    periodo_id: int,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db)
):
    try:
        # Verifica se pertence ao usuário
        res = await client.execute(
            "SELECT id FROM planejamento_periodos WHERE id = ? AND usuario_id = ?",
            [periodo_id, current_user["id"]]
        )
        if not res.rows:
            return {"error": "Período não encontrado ou não pertence a você."}
        
        # Apaga as músicas primeiro
        await client.execute(
            "DELETE FROM planejamento_musicas WHERE periodo_id = ?",
            [periodo_id]
        )
        # Apaga o período
        await client.execute(
            "DELETE FROM planejamento_periodos WHERE id = ?",
            [periodo_id]
        )
        return {"message": "Período deletado!"}
    except Exception as e:
        return {"error": str(e)}

@router.get("/{periodo_id}/musicas")
async def listar_musicas_do_periodo(
    periodo_id: int,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db)
):
    try:
        # Verifica dono
        res = await client.execute(
            "SELECT id FROM planejamento_periodos WHERE id = ? AND usuario_id = ?",
            [periodo_id, current_user["id"]]
        )
        if not res.rows:
            return {"error": "Período não encontrado."}
            
        sql = """
        SELECT pm.musica_id, pm.ordem, 
               b.nome_musica, b.artista, b.tags, b.link, b.codigo, 
               b.primeira_linha, b.tom, b.primeira_nota, b.versao_vocal, 
               b.compasso, b.bpm, b.cifra,
               COALESCE(NULLIF(GROUP_CONCAT(cr.nome, ', '), ''), b.categoria) as categorias_str,
               b.versao_parecida, b.tema_central
        FROM planejamento_musicas pm
        JOIN biblioteca_busca b ON pm.musica_id = b.id
        LEFT JOIN musica_categorias mc ON b.id = mc.musica_id
        LEFT JOIN categorias_repertorio cr ON mc.categoria_id = cr.id
        WHERE pm.periodo_id = ?
        GROUP BY pm.musica_id, pm.ordem
        ORDER BY pm.ordem ASC, pm.musica_id ASC
        """
        musicas = await client.execute(sql, [periodo_id])
        
        lista = []
        for r in musicas.rows:
            lista.append({
                "id": r[0],
                "ordem": r[1],
                "nome_musica": r[2] or "",
                "artista": r[3] or "",
                "tags": r[4] or "",
                "link": r[5] or "",
                "codigo": r[6] or "",
                "primeira_linha": r[7] or "",
                "tom": r[8] or "",
                "primeira_nota": r[9] or "",
                "versao_vocal": r[10] or "",
                "compasso": r[11] or "",
                "bpm": r[12] or "",
                "cifra": r[13] or "",
                "categoria": r[14] or "",
                "versao_parecida": r[15] or "",
                "tema_central": r[16] or ""
            })
            
        return {"musicas": lista}
    except Exception as e:
        return {"error": str(e)}

@router.post("/{periodo_id}/musicas")
async def adicionar_musica_ao_periodo(
    periodo_id: int,
    req: PeriodoAdicionarMusicaRequest,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db)
):
    try:
        res = await client.execute(
            "SELECT id FROM planejamento_periodos WHERE id = ? AND usuario_id = ?",
            [periodo_id, current_user["id"]]
        )
        if not res.rows:
            return {"error": "Período não encontrado."}
            
        await client.execute(
            "INSERT INTO planejamento_musicas (periodo_id, musica_id, ordem) VALUES (?, ?, ?)",
            [periodo_id, req.musica_id, req.ordem]
        )
        return {"message": "Música adicionada ao período!"}
    except Exception as e:
        if "UNIQUE constraint failed" in str(e):
            return {"error": "Música já está neste período."}
        return {"error": str(e)}

@router.delete("/{periodo_id}/musicas/{musica_id}")
async def remover_musica_do_periodo(
    periodo_id: int,
    musica_id: int,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db)
):
    try:
        res = await client.execute(
            "SELECT id FROM planejamento_periodos WHERE id = ? AND usuario_id = ?",
            [periodo_id, current_user["id"]]
        )
        if not res.rows:
            return {"error": "Período não encontrado."}
            
        await client.execute(
            "DELETE FROM planejamento_musicas WHERE periodo_id = ? AND musica_id = ?",
            [periodo_id, musica_id]
        )
        return {"message": "Música removida do período."}
    except Exception as e:
        return {"error": str(e)}
