import io
import json
import pandas as pd
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel
import libsql_client

from api.database import get_db
from api.security import get_current_user

router = APIRouter(prefix="/excel", tags=["Excel Import"])

# Definições de payloads
class ExcelImportCommitRequest(BaseModel):
    items: List[Dict[str, Any]]
    fonte_verdade: str = "excel" # "excel" ou "banco"

def sanitize_str(val) -> str:
    if pd.isna(val) or val is None:
        return ""
    return str(val).strip()

def parse_categorias(val: str) -> List[str]:
    if not val:
        return []
    # Separa por vírgula e remove espaços vazios
    return [c.strip() for c in val.split(",") if c.strip()]

@router.post("/preview")
async def preview_excel(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db)
):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Formato inválido. Envie um arquivo Excel (.xlsx ou .xls).")

    try:
        contents = await file.read()
        # Lê o Excel. Não define header fixo inicialmente para procurar a linha certa.
        df_raw = pd.read_excel(io.BytesIO(contents), header=None)
        
        # Procura a linha que contém o cabeçalho (procurando por algo como "NOME DA MÚSICA" ou "TÍTULO")
        header_idx = 0
        for idx, row in df_raw.iterrows():
            row_str = " ".join([str(c).upper() for c in row if not pd.isna(c)])
            if "NOME DA MÚSICA" in row_str or "TÍTULO" in row_str or "PRIMEIRA LINHA" in row_str:
                header_idx = idx
                break
                
        # Recarrega o DF usando a linha encontrada como cabeçalho
        df = pd.read_excel(io.BytesIO(contents), header=header_idx)
        
        # Limpa nomes das colunas
        df.columns = [str(c).strip().upper() for c in df.columns]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar o arquivo Excel: {str(e)}")

    # Mapeamento dinâmico de colunas
    col_map = {
        "nome_musica": next((c for c in df.columns if "NOME DA MÚSICA" in c or "TÍTULO" in c), None),
        "codigo": next((c for c in df.columns if "CÓD." in c or "CÓDIGO" in c), None),
        "primeira_linha": next((c for c in df.columns if "PRIMEIRA LINHA" in c), None),
        "versao_parecida": next((c for c in df.columns if "VERSÃO PARECIDA" in c), None),
        "tema_central": next((c for c in df.columns if "TEMA CENTRAL" in c and "CATEGORIA" not in c), None),
        "categorias": next((c for c in df.columns if "CATEGORIA" in c), None),
        "cifra": next((c for c in df.columns if "CIFRA" in c), None),
        "tom": next((c for c in df.columns if "TOM" in c), None),
        "primeira_nota": next((c for c in df.columns if "1ª NOTA" in c or "PRIMEIRA NOTA" in c), None),
        "versao_vocal": next((c for c in df.columns if "VERSÃO P VOCAL" in c or "VERSÃO PARA VOCAL" in c), None),
        "compasso": next((c for c in df.columns if "COMPASSO" in c), None),
        "bpm": next((c for c in df.columns if "BPM" in c), None),
    }

    if not col_map["nome_musica"]:
        raise HTTPException(status_code=400, detail="Coluna 'Nome da Música' ou 'Título' não encontrada na planilha.")

    # Busca músicas existentes do usuário
    user_id = current_user["id"]
    existing_musics = await client.execute(
        """
        SELECT id, nome_musica, artista, codigo, primeira_linha, tom, primeira_nota, 
               versao_vocal, compasso, bpm, cifra, versao_parecida, tema_central 
        FROM biblioteca_busca WHERE usuario_id = ?
        """,
        [user_id]
    )
    
    # Busca categorias das músicas existentes
    db_musics_dict = {}
    for r in existing_musics.rows:
        m_id = r[0]
        # Pega as tags do banco
        cats_res = await client.execute(
            """
            SELECT cr.nome FROM musica_categorias mc
            JOIN categorias_repertorio cr ON mc.categoria_id = cr.id
            WHERE mc.musica_id = ?
            """,
            [m_id]
        )
        db_cats = [cr[0] for cr in cats_res.rows]
        
        db_musics_dict[m_id] = {
            "id": m_id,
            "nome_musica": r[1] or "",
            "artista": r[2] or "",
            "codigo": r[3] or "",
            "primeira_linha": r[4] or "",
            "tom": r[5] or "",
            "primeira_nota": r[6] or "",
            "versao_vocal": r[7] or "",
            "compasso": r[8] or "",
            "bpm": r[9] or "",
            "cifra": r[10] or "",
            "versao_parecida": r[11] or "",
            "tema_central": r[12] or "",
            "categorias": db_cats
        }

    # Indexa o dict por nome para match fácil (normalizando strings)
    def normalize(text):
        return str(text).strip().lower()

    db_search_index = {}
    for m in db_musics_dict.values():
        key = f"{normalize(m['nome_musica'])}||{normalize(m['artista'])}"
        db_search_index[key] = m

    preview_items = []
    
    for idx, row in df.iterrows():
        nome = sanitize_str(row[col_map["nome_musica"]])
        if not nome:
            continue
            
        # Extrai artista do Nome da Música se houver parênteses "Meu Mestre (Irmão Lázaro)"
        artista = ""
        import re
        match_artist = re.search(r'\((.*?)\)', nome)
        if match_artist:
            artista = match_artist.group(1).strip()
            # Limpa o nome da música removendo os parênteses
            nome = re.sub(r'\(.*?\)', '', nome).strip()
            
        # Monta os dados lidos do Excel
        excel_cats = parse_categorias(sanitize_str(row[col_map["categorias"]])) if col_map["categorias"] else []
        # Fallback: se não tiver coluna CATEGORIAS, tenta pegar do Tema Central
        if not excel_cats and col_map["tema_central"]:
            fallback_cats = parse_categorias(sanitize_str(row[col_map["tema_central"]]))
            if fallback_cats:
                excel_cats = fallback_cats
                
        excel_data = {
            "nome_musica": nome,
            "artista": artista,
            "codigo": sanitize_str(row[col_map["codigo"]]) if col_map["codigo"] else "",
            "primeira_linha": sanitize_str(row[col_map["primeira_linha"]]) if col_map["primeira_linha"] else "",
            "versao_parecida": sanitize_str(row[col_map["versao_parecida"]]) if col_map["versao_parecida"] else "",
            "tema_central": sanitize_str(row[col_map["tema_central"]]) if col_map["tema_central"] else "",
            "categorias": excel_cats,
            "cifra": sanitize_str(row[col_map["cifra"]]) if col_map["cifra"] else "",
            "tom": sanitize_str(row[col_map["tom"]]) if col_map["tom"] else "",
            "primeira_nota": sanitize_str(row[col_map["primeira_nota"]]) if col_map["primeira_nota"] else "",
            "versao_vocal": sanitize_str(row[col_map["versao_vocal"]]) if col_map["versao_vocal"] else "",
            "compasso": sanitize_str(row[col_map["compasso"]]) if col_map["compasso"] else "",
            "bpm": sanitize_str(row[col_map["bpm"]]) if col_map["bpm"] else "",
        }
        
        # Procura no banco de dados
        search_key = f"{normalize(nome)}||{normalize(artista)}"
        db_match = db_search_index.get(search_key)
        
        if not db_match:
            # Tenta encontrar só pelo nome
            db_match = next((v for v in db_musics_dict.values() if normalize(v["nome_musica"]) == normalize(nome)), None)
            
        status = "new"
        errors = []
        if not excel_data["categorias"]:
            errors.append("Falta a coluna/campo de Categorias")
            status = "error"
            
        if db_match:
            if status != "error":
                status = "update"
            preview_items.append({
                "status": status,
                "errors": errors,
                "excel_data": excel_data,
                "db_data": db_match
            })
        else:
            preview_items.append({
                "status": status,
                "errors": errors,
                "excel_data": excel_data,
                "db_data": None
            })
            
    return {"items": preview_items}


@router.post("/commit")
async def commit_excel(
    payload: ExcelImportCommitRequest,
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db)
):
    user_id = current_user["id"]
    inserted = 0
    updated = 0
    
    for item in payload.items:
        excel = item.get("excel_data", {})
        db = item.get("db_data")
        status = item.get("status")
        
        if status == "error":
            continue
            
        # Decide qual será a fonte da verdade para o merge
        # Se 'excel', valores vazios no Excel não apagam valores do BD (apenas substitui se tiver).
        # Se 'banco', valores existentes no banco não são sobrescritos pelo Excel.
        final_data = {}
        
        keys = ["nome_musica", "artista", "codigo", "primeira_linha", "tom", "primeira_nota", 
                "versao_vocal", "compasso", "bpm", "cifra", "versao_parecida", "tema_central"]
                
        if db:
            for k in keys:
                val_excel = excel.get(k, "")
                val_db = db.get(k, "")
                
                if payload.fonte_verdade == "excel":
                    final_data[k] = val_excel if val_excel != "" else val_db
                else:
                    final_data[k] = val_db if val_db != "" else val_excel
                    
            final_cats = excel.get("categorias", []) if payload.fonte_verdade == "excel" and excel.get("categorias") else db.get("categorias", [])
            if not final_cats and excel.get("categorias"):
                 final_cats = excel.get("categorias")
        else:
            for k in keys:
                final_data[k] = excel.get(k, "")
            final_cats = excel.get("categorias", [])

        if not final_cats:
            final_cats = ["Geral"] # Fallback

        # Salva as tags como string pro BD
        tags = ", ".join(final_cats).lower()

        try:
            if status == "update" and db:
                # Faz update
                await client.execute(
                    """
                    UPDATE biblioteca_busca SET
                        nome_musica = ?, artista = ?, tags = ?, codigo = ?, primeira_linha = ?,
                        tom = ?, primeira_nota = ?, versao_vocal = ?, compasso = ?, bpm = ?,
                        cifra = ?, versao_parecida = ?, tema_central = ?
                    WHERE id = ? AND usuario_id = ?
                    """,
                    [final_data["nome_musica"], final_data["artista"], tags, final_data["codigo"], final_data["primeira_linha"],
                     final_data["tom"], final_data["primeira_nota"], final_data["versao_vocal"], final_data["compasso"], final_data["bpm"],
                     final_data["cifra"], final_data["versao_parecida"], final_data["tema_central"], db["id"], user_id]
                )
                musica_id = db["id"]
                updated += 1
                
                # Reseta categorias
                await client.execute("DELETE FROM musica_categorias WHERE musica_id = ?", [musica_id])
                
            elif status == "new":
                res = await client.execute(
                    """
                    INSERT INTO biblioteca_busca (
                        nome_musica, artista, tags, link, codigo, primeira_linha, tom, primeira_nota,
                        versao_vocal, compasso, bpm, cifra, versao_parecida, tema_central, usuario_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    [final_data["nome_musica"], final_data["artista"], tags, "", final_data["codigo"], final_data["primeira_linha"],
                     final_data["tom"], final_data["primeira_nota"], final_data["versao_vocal"], final_data["compasso"], final_data["bpm"],
                     final_data["cifra"], final_data["versao_parecida"], final_data["tema_central"], user_id]
                )
                musica_id = res.last_insert_rowid
                inserted += 1

            # Sincroniza as Categorias
            for cat_nome in final_cats:
                cat_nome_clean = cat_nome.strip()
                cat_res = await client.execute(
                    "SELECT id FROM categorias_repertorio WHERE LOWER(nome) = ? AND (usuario_id = ? OR usuario_id IS NULL)",
                    [cat_nome_clean.lower(), user_id]
                )
                if not cat_res.rows:
                    new_cat = await client.execute(
                        "INSERT INTO categorias_repertorio (nome, cor, usuario_id) VALUES (?, ?, ?)",
                        [cat_nome_clean, "#808080", user_id]
                    )
                    cat_id = new_cat.last_insert_rowid
                else:
                    cat_id = cat_res.rows[0][0]
                    
                await client.execute(
                    "INSERT INTO musica_categorias (musica_id, categoria_id) VALUES (?, ?)",
                    [musica_id, cat_id]
                )

        except Exception as e:
            print(f"Erro ao salvar musica {final_data.get('nome_musica')}: {e}")
            pass

    return {"message": f"Importação concluída. {inserted} inseridas, {updated} atualizadas.", "inserted": inserted, "updated": updated}
