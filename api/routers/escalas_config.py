# arquivo: api/routers/escalas_config.py
#
# Rotas para persistência da configuração de escalas no Turso:
#   - Disponibilidades (indisponibilidades dos membros por mês)
#   - Vagas por Dia (quais funções estão ativas em cada culto)
#
# Design: um registro por (usuario_id, mes_ano) em cada tabela,
# contendo o payload completo como JSON. Isso evita linhas individuais
# por membro/data e simplifica o frontend (salva/carrega tudo de uma vez).

import json
from fastapi import APIRouter, Depends
import libsql_client

from api.database import get_db
from api.models import DisponibilidadesRequest, VagasConfigRequest, RegrasConfigRequest
from api.security import get_current_user

router = APIRouter(tags=["Escalas Config"])


# =============================================================================
# DISPONIBILIDADES
# =============================================================================

@router.get("/escala/disponibilidades")
async def get_disponibilidades(
    mes: int,
    ano: int,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db),
):
    """Retorna o mapa de indisponibilidades do mês para o usuário logado."""
    try:
        mes_ano = f"{mes}-{ano}"
        result = await client.execute(
            "SELECT dados FROM escala_disponibilidades WHERE usuario_id = ? AND mes_ano = ?",
            [current_user["id"], mes_ano],
        )
        if result.rows:
            indisponibilidades = json.loads(result.rows[0][0])
        else:
            indisponibilidades = {}
        return {"indisponibilidades": indisponibilidades}
    except Exception as e:
        return {"error": str(e)}


@router.post("/escala/disponibilidades")
async def save_disponibilidades(
    payload: DisponibilidadesRequest,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db),
):
    """
    Salva (upsert) o mapa completo de indisponibilidades de um mês.
    O frontend envia o estado inteiro; o backend sobrescreve o registro.
    """
    try:
        mes_ano = f"{payload.mes}-{payload.ano}"
        dados_json = json.dumps(payload.indisponibilidades)

        # UPSERT: tenta inserir, conflito → atualiza
        await client.execute(
            """
            INSERT INTO escala_disponibilidades (usuario_id, mes_ano, dados)
            VALUES (?, ?, ?)
            ON CONFLICT(usuario_id, mes_ano) DO UPDATE SET dados = excluded.dados
            """,
            [current_user["id"], mes_ano, dados_json],
        )
        return {"message": "Disponibilidades salvas com sucesso!"}
    except Exception as e:
        return {"error": str(e)}


# =============================================================================
# VAGAS POR DIA
# =============================================================================

@router.get("/escala/vagas")
async def get_vagas_config(
    mes: int,
    ano: int,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db),
):
    """Retorna a configuração de vagas por dia do mês para o usuário logado."""
    try:
        mes_ano = f"{mes}-{ano}"
        result = await client.execute(
            "SELECT dados FROM escala_vagas_config WHERE usuario_id = ? AND mes_ano = ?",
            [current_user["id"], mes_ano],
        )
        if result.rows:
            vagas_por_dia = json.loads(result.rows[0][0])
        else:
            vagas_por_dia = {}
        return {"vagas_por_dia": vagas_por_dia}
    except Exception as e:
        return {"error": str(e)}


@router.post("/escala/vagas")
async def save_vagas_config(
    payload: VagasConfigRequest,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db),
):
    """
    Salva (upsert) a configuração de vagas de todos os dias de um mês.
    """
    try:
        mes_ano = f"{payload.mes}-{payload.ano}"
        dados_json = json.dumps(payload.vagas_por_dia)

        await client.execute(
            """
            INSERT INTO escala_vagas_config (usuario_id, mes_ano, dados)
            VALUES (?, ?, ?)
            ON CONFLICT(usuario_id, mes_ano) DO UPDATE SET dados = excluded.dados
            """,
            [current_user["id"], mes_ano, dados_json],
        )
        return {"message": "Configuração de vagas salva com sucesso!"}
    except Exception as e:
        return {"error": str(e)}


# =============================================================================
# REGRAS ESPECÍFICAS
# =============================================================================

@router.get("/escala/regras")
async def get_regras_config(
    mes: int,
    ano: int,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db),
):
    """Retorna as regras configuradas no mês para o usuário logado."""
    try:
        mes_ano = f"{mes}-{ano}"
        result = await client.execute(
            "SELECT dados FROM escala_regras_config WHERE usuario_id = ? AND mes_ano = ?",
            [current_user["id"], mes_ano],
        )
        if result.rows:
            regras = json.loads(result.rows[0][0])
        else:
            regras = []
        return {"regras": regras}
    except Exception as e:
        return {"error": str(e)}


@router.post("/escala/regras")
async def save_regras_config(
    payload: RegrasConfigRequest,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db),
):
    """
    Salva (upsert) as regras de um mês.
    """
    try:
        mes_ano = f"{payload.mes}-{payload.ano}"
        dados_json = json.dumps(payload.regras)

        await client.execute(
            """
            INSERT INTO escala_regras_config (usuario_id, mes_ano, dados)
            VALUES (?, ?, ?)
            ON CONFLICT(usuario_id, mes_ano) DO UPDATE SET dados = excluded.dados
            """,
            [current_user["id"], mes_ano, dados_json],
        )
        return {"message": "Regras salvas com sucesso!"}
    except Exception as e:
        return {"error": str(e)}

# =============================================================================
# MATRIZ (ESCALA GERADA)
# =============================================================================

@router.get("/escala/matriz")
async def get_matriz_config(
    mes: int,
    ano: int,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db),
):
    """Retorna a escala gerada e a ordem das vagas salvas no mês."""
    try:
        mes_ano = f"{mes}-{ano}"
        result = await client.execute(
            "SELECT dados FROM escala_matriz_config WHERE usuario_id = ? AND mes_ano = ?",
            [current_user["id"], mes_ano],
        )
        if result.rows:
            dados = json.loads(result.rows[0][0])
            return dados
        else:
            return {"escalas_geradas": [], "ordem_matriz": []}
    except Exception as e:
        return {"error": str(e)}

@router.post("/escala/matriz")
async def save_matriz_config(
    payload: MatrizConfigRequest,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db),
):
    """
    Salva (upsert) a escala gerada de um mês.
    """
    try:
        mes_ano = f"{payload.mes}-{payload.ano}"
        dados_json = json.dumps({
            "escalas_geradas": payload.escalas_geradas,
            "ordem_matriz": payload.ordem_matriz
        })

        await client.execute(
            """
            INSERT INTO escala_matriz_config (usuario_id, mes_ano, dados)
            VALUES (?, ?, ?)
            ON CONFLICT(usuario_id, mes_ano) DO UPDATE SET dados = excluded.dados
            """,
            [current_user["id"], mes_ano, dados_json],
        )
        return {"message": "Escala gerada salva com sucesso!"}
    except Exception as e:
        return {"error": str(e)}
