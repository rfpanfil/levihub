# arquivo: api/routers/equipe.py
# Rotas de gestão de equipe: membros (CRUD) e funções/instrumentos (CRUD).

from fastapi import APIRouter, Depends, HTTPException
import libsql_client
import json

from api.database import get_db
from api.models import MembroRequest, FuncaoRequest
from api.security import get_current_user

router = APIRouter(tags=["Equipe"])


# =============================================================================
# MEMBROS
# =============================================================================

@router.get("/equipe")
async def get_equipe(
    apenas_ativos: bool = True,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db),
):
    """Retorna apenas os membros vinculados ao usuário logado."""
    try:
        user_id = current_user["id"]
        query = """
            SELECT m.id, m.nome, m.telefone, m.email, m.status,
                   GROUP_CONCAT(TRIM(f.nome)) as funcoes
            FROM membros m
            LEFT JOIN membro_funcoes mf ON m.id = mf.membro_id
            LEFT JOIN funcoes f ON mf.funcao_id = f.id
            WHERE m.usuario_id = ?
        """
        if apenas_ativos:
            query += " AND m.status = 'ativo' "
        query += " GROUP BY m.id ORDER BY m.nome"

        result = await client.execute(query, [user_id])
        equipe = []
        for row in result.rows:
            funcoes_lista = row[5].split(",") if row[5] else []
            equipe.append({
                "id": row[0], "nome": row[1],
                "telefone": row[2] or "", "email": row[3] or "",
                "status": row[4] or "ativo", "funcoes": funcoes_lista,
            })
        return {"equipe": equipe}
    except Exception as e:
        return {"error": str(e)}


@router.post("/equipe")
async def add_membro(
    membro: MembroRequest,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db),
):
    try:
        user_id = current_user["id"]
        res = await client.execute(
            "INSERT INTO membros (nome, telefone, email, status, usuario_id) VALUES (?, ?, ?, ?, ?)",
            [membro.nome, membro.telefone, membro.email, membro.status, user_id],
        )
        membro_id = res.last_insert_rowid

        for f in membro.funcoes:
            f_res = await client.execute(
                "SELECT id FROM funcoes WHERE TRIM(nome) = ? AND (usuario_id = ? OR usuario_id IS NULL)",
                [f.strip(), user_id],
            )
            if f_res.rows:
                await client.execute(
                    "INSERT INTO membro_funcoes (membro_id, funcao_id) VALUES (?, ?)",
                    [membro_id, f_res.rows[0][0]],
                )
        return {"message": "Membro adicionado com sucesso!", "id": membro_id}
    except Exception as e:
        return {"error": str(e)}


@router.put("/equipe/{membro_id}")
async def update_membro(
    membro_id: int,
    membro: MembroRequest,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db),
):
    try:
        user_id = current_user["id"]
        check = await client.execute(
            "SELECT id FROM membros WHERE id = ? AND usuario_id = ?", [membro_id, user_id]
        )
        if not check.rows:
            raise HTTPException(
                status_code=403, detail="Você não tem permissão para editar este membro."
            )
        await client.execute(
            "UPDATE membros SET nome = ?, telefone = ?, email = ?, status = ? WHERE id = ?",
            [membro.nome, membro.telefone, membro.email, membro.status, membro_id],
        )
        await client.execute("DELETE FROM membro_funcoes WHERE membro_id = ?", [membro_id])
        for f in membro.funcoes:
            f_res = await client.execute(
                "SELECT id FROM funcoes WHERE TRIM(nome) = ? AND (usuario_id = ? OR usuario_id IS NULL)",
                [f.strip(), user_id],
            )
            if f_res.rows:
                await client.execute(
                    "INSERT INTO membro_funcoes (membro_id, funcao_id) VALUES (?, ?)",
                    [membro_id, f_res.rows[0][0]],
                )
        return {"message": "Membro atualizado com sucesso!"}
    except Exception as e:
        return {"error": str(e)}


@router.delete("/equipe/{membro_id}")
async def delete_membro(
    membro_id: int,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db),
):
    try:
        await client.execute(
            "DELETE FROM membros WHERE id = ? AND usuario_id = ?",
            [membro_id, current_user["id"]],
        )
        return {"message": "Membro excluído com sucesso!"}
    except Exception as e:
        return {"error": str(e)}


# =============================================================================
# FUNÇÕES / INSTRUMENTOS
# =============================================================================

@router.get("/funcoes")
async def get_funcoes(
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db),
):
    try:
        query = """
            SELECT id, TRIM(nome) as nome_funcao, permitidas_acumular, obrigatorias_acumular FROM funcoes
            WHERE usuario_id = ? OR usuario_id IS NULL
            UNION
            SELECT f.id, TRIM(f.nome) as nome_funcao, f.permitidas_acumular, f.obrigatorias_acumular FROM funcoes f
            JOIN membro_funcoes mf ON f.id = mf.funcao_id
            JOIN membros m ON mf.membro_id = m.id
            WHERE m.usuario_id = ?
            ORDER BY nome_funcao
        """
        result = await client.execute(query, [current_user["id"], current_user["id"]])
        funcoes = []
        for row in result.rows:
            try: permitidas = json.loads(row[2]) if row[2] else []
            except: permitidas = []
            
            try: obrigatorias = json.loads(row[3]) if row[3] else []
            except: obrigatorias = []

            funcoes.append({
                "id": row[0], "nome": row[1],
                "permitidas_acumular": permitidas,
                "obrigatorias_acumular": obrigatorias
            })
        return {"funcoes": funcoes}
    except Exception as e:
        return {"error": str(e)}


@router.post("/funcoes")
async def add_funcao(
    funcao: FuncaoRequest,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db),
):
    try:
        user_id = current_user["id"]
        nome_limpo = funcao.nome.strip()
        permitidas_str = json.dumps(funcao.permitidas_acumular or [])
        obrigatorias_str = json.dumps(funcao.obrigatorias_acumular or [])

        try:
            res = await client.execute(
                "INSERT INTO funcoes (nome, usuario_id, permitidas_acumular, obrigatorias_acumular) VALUES (?, ?, ?, ?)",
                [nome_limpo, user_id, permitidas_str, obrigatorias_str],
            )
            funcao_id = res.last_insert_rowid
        except Exception:
            # Conflito de UNIQUE: busca a entrada existente para este usuário
            existing = await client.execute(
                "SELECT id FROM funcoes WHERE TRIM(nome) = ? AND usuario_id = ?",
                [nome_limpo, user_id],
            )
            if existing.rows:
                # Já existe para este usuário — reutiliza o ID
                funcao_id = existing.rows[0][0]
            else:
                # Pode ser função global (usuario_id IS NULL) aguardando adoção
                global_res = await client.execute(
                    "SELECT id FROM funcoes WHERE TRIM(nome) = ? AND usuario_id IS NULL",
                    [nome_limpo],
                )
                if global_res.rows:
                    # Adota a função global vinculando ao usuário
                    funcao_id = global_res.rows[0][0]
                    await client.execute(
                        "UPDATE funcoes SET usuario_id = ? WHERE id = ?",
                        [user_id, funcao_id],
                    )
                else:
                    return {"error": "Falha ao processar função: conflito no banco."}

        if funcao.membros_ids:
            for m_id in funcao.membros_ids:
                check_mf = await client.execute(
                    "SELECT 1 FROM membro_funcoes WHERE membro_id = ? AND funcao_id = ?",
                    [m_id, funcao_id],
                )
                if not check_mf.rows:
                    await client.execute(
                        "INSERT INTO membro_funcoes (membro_id, funcao_id) VALUES (?, ?)",
                        [m_id, funcao_id],
                    )
        return {"message": "Função criada com sucesso!", "id": funcao_id}
    except Exception as e:
        return {"error": str(e)}


@router.put("/funcoes/{funcao_id}")
async def update_funcao(
    funcao_id: int,
    funcao: FuncaoRequest,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db),
):
    try:
        nome_limpo = funcao.nome.strip()
        permitidas_str = json.dumps(funcao.permitidas_acumular or [])
        obrigatorias_str = json.dumps(funcao.obrigatorias_acumular or [])
        await client.execute(
            "UPDATE funcoes SET nome = ?, permitidas_acumular = ?, obrigatorias_acumular = ? WHERE id = ? AND (usuario_id = ? OR usuario_id IS NULL)",
            [nome_limpo, permitidas_str, obrigatorias_str, funcao_id, current_user["id"]],
        )
        return {"message": "Função atualizada!"}
    except Exception as e:
        return {"error": str(e)}


@router.delete("/funcoes/{funcao_id}")
async def delete_funcao(
    funcao_id: int,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db),
):
    try:
        await client.execute(
            "DELETE FROM funcoes WHERE id = ? AND (usuario_id = ? OR usuario_id IS NULL)",
            [funcao_id, current_user["id"]],
        )
        return {"message": "Função excluída!"}
    except Exception as e:
        return {"error": str(e)}
