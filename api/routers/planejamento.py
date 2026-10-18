# arquivo: api/routers/planejamento.py
import json
from fastapi import APIRouter, Depends
import libsql_client
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from api.database import get_db
from api.security import get_current_user
from api.models import PeriodoCreateRequest, PeriodoUpdateRequest, PeriodoAdicionarMusicaRequest

router = APIRouter(prefix="/planejamento", tags=["Planejamento"])


class PeriodoSyncMusicasRequest(BaseModel):
    musica_ids: List[int]


class PeriodoCultosUpdateRequest(BaseModel):
    cultos: List[Dict[str, Any]]


class PreferenciasPlanejamentoRequest(BaseModel):
    whats_opts: Optional[Dict[str, bool]] = None
    visible_cols: Optional[List[str]] = None


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

        pref_res = await client.execute(
            "SELECT preferencias_planejamento FROM usuarios WHERE id = ?",
            [current_user["id"]]
        )
        preferencias = {}
        if pref_res.rows and pref_res.rows[0][0]:
            try:
                preferencias = json.loads(pref_res.rows[0][0])
            except Exception:
                preferencias = {}

        return {"periodos": periodos, "preferencias": preferencias}
    except Exception as e:
        return {"error": str(e)}


@router.put("/preferencias")
async def salvar_preferencias_planejamento(
    req: PreferenciasPlanejamentoRequest,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db)
):
    try:
        pref_res = await client.execute(
            "SELECT preferencias_planejamento FROM usuarios WHERE id = ?",
            [current_user["id"]]
        )
        atual = {}
        if pref_res.rows and pref_res.rows[0][0]:
            try:
                atual = json.loads(pref_res.rows[0][0])
            except Exception:
                atual = {}

        if req.whats_opts is not None:
            atual["whats_opts"] = req.whats_opts
        if req.visible_cols is not None:
            atual["visible_cols"] = req.visible_cols

        await client.execute(
            "UPDATE usuarios SET preferencias_planejamento = ? WHERE id = ?",
            [json.dumps(atual, ensure_ascii=False), current_user["id"]]
        )
        return {"message": "Preferências salvas!", "preferencias": atual}
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
            "INSERT INTO planejamento_periodos (usuario_id, nome, programacao_cultos) VALUES (?, ?, '[]')",
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
        res = await client.execute(
            "SELECT id FROM planejamento_periodos WHERE id = ? AND usuario_id = ?",
            [periodo_id, current_user["id"]]
        )
        if not res.rows:
            return {"error": "Período não encontrado ou não pertence a você."}
        
        await client.execute(
            "DELETE FROM planejamento_musicas WHERE periodo_id = ?",
            [periodo_id]
        )
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
        res = await client.execute(
            "SELECT id, programacao_cultos FROM planejamento_periodos WHERE id = ? AND usuario_id = ?",
            [periodo_id, current_user["id"]]
        )
        if not res.rows:
            return {"error": "Período não encontrado."}
            
        raw_cultos = res.rows[0][1]
        try:
            programacao_cultos = json.loads(raw_cultos) if raw_cultos else []
        except Exception:
            programacao_cultos = []

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
            
        return {"musicas": lista, "programacao_cultos": programacao_cultos}
    except Exception as e:
        return {"error": str(e)}


@router.put("/{periodo_id}/musicas")
async def salvar_musicas_do_periodo(
    periodo_id: int,
    req: PeriodoSyncMusicasRequest,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db)
):
    """
    Sincroniza (Salva) a lista completa de músicas do período de uma só vez.
    Preserva a data 'adicionado_em' das músicas que já estavam salvas no período
    e registra datetime('now') apenas para as novas músicas adicionadas.
    """
    try:
        res = await client.execute(
            "SELECT id FROM planejamento_periodos WHERE id = ? AND usuario_id = ?",
            [periodo_id, current_user["id"]]
        )
        if not res.rows:
            return {"error": "Período não encontrado."}

        existing_res = await client.execute(
            "SELECT musica_id, adicionado_em FROM planejamento_musicas WHERE periodo_id = ?",
            [periodo_id]
        )
        existing_map = {r[0]: r[1] for r in existing_res.rows}

        await client.execute(
            "DELETE FROM planejamento_musicas WHERE periodo_id = ?",
            [periodo_id]
        )

        seen = set()
        for idx, m_id in enumerate(req.musica_ids):
            if m_id in seen:
                continue
            seen.add(m_id)
            prev_ts = existing_map.get(m_id)
            if prev_ts:
                await client.execute(
                    "INSERT INTO planejamento_musicas (periodo_id, musica_id, ordem, adicionado_em) VALUES (?, ?, ?, ?)",
                    [periodo_id, m_id, idx, prev_ts]
                )
            else:
                await client.execute(
                    "INSERT INTO planejamento_musicas (periodo_id, musica_id, ordem, adicionado_em) VALUES (?, ?, ?, datetime('now'))",
                    [periodo_id, m_id, idx]
                )

        return {"message": "Planejamento salvo com sucesso!"}
    except Exception as e:
        return {"error": str(e)}


@router.put("/{periodo_id}/cultos")
async def salvar_cultos_do_periodo(
    periodo_id: int,
    req: PeriodoCultosUpdateRequest,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db)
):
    """Salva a programação de domingos/cultos do período."""
    try:
        res = await client.execute(
            "SELECT id FROM planejamento_periodos WHERE id = ? AND usuario_id = ?",
            [periodo_id, current_user["id"]]
        )
        if not res.rows:
            return {"error": "Período não encontrado."}

        await client.execute(
            "UPDATE planejamento_periodos SET programacao_cultos = ? WHERE id = ? AND usuario_id = ?",
            [json.dumps(req.cultos, ensure_ascii=False), periodo_id, current_user["id"]]
        )
        return {"message": "Programação de cultos salva com sucesso!"}
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
            "INSERT INTO planejamento_musicas (periodo_id, musica_id, ordem, adicionado_em) VALUES (?, ?, ?, datetime('now'))",
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
