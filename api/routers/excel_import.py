import io
import json
import pandas as pd
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, Protection
from openpyxl.utils import get_column_letter
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import Response
from pydantic import BaseModel
import libsql_client

from api.database import get_db, find_or_create_categoria
from api.security import get_current_user

router = APIRouter(
    prefix="/excel",
    tags=["Excel Import"],
    dependencies=[Depends(get_current_user)],
)


def _resolve_target_user_id(current_user: dict, escopo: str = "pessoal") -> Optional[int]:
    """
    Retorna user_id para escopo='pessoal', ou None para escopo='global' (exige admin).
    """
    if (escopo or "pessoal").strip().lower() == "global":
        if current_user.get("role") != "admin":
            raise HTTPException(
                status_code=403,
                detail="Acesso negado. Apenas administradores podem gerenciar o repertório global.",
            )
        return None
    return current_user["id"]

# Definições de payloads
class ExcelImportCommitRequest(BaseModel):
    items: List[Dict[str, Any]]
    fonte_verdade: str = "excel" # "excel" ou "banco"

class BulkExportRequest(BaseModel):
    musica_ids: List[int]
    campos: List[str]

class BulkCommitRequest(BaseModel):
    items: List[Dict[str, Any]]

BULK_FIELDS_META: Dict[str, Dict[str, str]] = {
    "tema_central": {"label": "Tema Central", "header": "TEMA CENTRAL"},
    "categorias": {"label": "Categorias", "header": "CATEGORIAS"},
    "tags": {"label": "Tags / Palavras-Chave", "header": "TAGS"},
    "tom": {"label": "Tom", "header": "TOM"},
    "primeira_nota": {"label": "1ª Nota", "header": "1ª NOTA"},
    "primeira_linha": {"label": "Primeira Linha", "header": "PRIMEIRA LINHA"},
    "nome_musica": {"label": "Nome da Música", "header": "NOME DA MÚSICA"},
    "artista": {"label": "Artista / Banda", "header": "ARTISTA"},
    "codigo": {"label": "Código Interno", "header": "CÓDIGO"},
    "link": {"label": "Link YouTube", "header": "LINK YOUTUBE"},
    "versao_vocal": {"label": "Versão p/ Vocal", "header": "VERSÃO P/ VOCAL"},
    "compasso": {"label": "Compasso", "header": "COMPASSO"},
    "bpm": {"label": "BPM ≈", "header": "BPM"},
    "versao_parecida": {"label": "Versão Parecida", "header": "VERSÃO PARECIDA"},
    "cifra": {"label": "Cifra", "header": "CIFRA"},
}

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
    escopo: str = "pessoal",
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
        "artista": next((c for c in df.columns if "ARTISTA" in c), None),
        "codigo": next((c for c in df.columns if "CÓD." in c or "CÓDIGO" in c), None),
        "primeira_linha": next((c for c in df.columns if "PRIMEIRA LINHA" in c), None),
        "versao_parecida": next((c for c in df.columns if "VERSÃO PARECIDA" in c), None),
        "tema_central": next((c for c in df.columns if "TEMA CENTRAL" in c), None),
        "categorias": next((c for c in df.columns if "CATEGORIA" in c), None),
        "tags": next((c for c in df.columns if "TAG" in c or "PALAVRAS-CHAVE" in c or "PALAVRAS CHAVE" in c), None),
        "cifra": next((c for c in df.columns if "CIFRA" in c), None),
        "tom": next((c for c in df.columns if "TOM" in c), None),
        "primeira_nota": next((c for c in df.columns if "1ª NOTA" in c or "PRIMEIRA NOTA" in c), None),
        "versao_vocal": next((c for c in df.columns if "VERSÃO P VOCAL" in c or "VERSÃO PARA VOCAL" in c), None),
        "compasso": next((c for c in df.columns if "COMPASSO" in c), None),
        "bpm": next((c for c in df.columns if "BPM" in c), None),
        "link": next((c for c in df.columns if "LINK" in c), None),
    }

    if not col_map["nome_musica"]:
        raise HTTPException(status_code=400, detail="Coluna 'Nome da Música' ou 'Título' não encontrada na planilha.")

    # Busca músicas existentes do escopo selecionado (pessoal ou global)
    target_user_id = _resolve_target_user_id(current_user, escopo)
    if target_user_id is None:
        existing_musics = await client.execute(
            """
            SELECT id, nome_musica, artista, codigo, primeira_linha, tom, primeira_nota, 
                   versao_vocal, compasso, bpm, cifra, versao_parecida, tema_central, link, tags, categoria
            FROM biblioteca_busca WHERE usuario_id IS NULL
            """
        )
    else:
        existing_musics = await client.execute(
            """
            SELECT id, nome_musica, artista, codigo, primeira_linha, tom, primeira_nota, 
                   versao_vocal, compasso, bpm, cifra, versao_parecida, tema_central, link, tags, categoria
            FROM biblioteca_busca WHERE usuario_id = ?
            """,
            [target_user_id]
        )
    
    # Busca categorias das músicas existentes
    db_musics_dict = {}
    for r in existing_musics.rows:
        m_id = r[0]
        cats_res = await client.execute(
            """
            SELECT cr.nome FROM musica_categorias mc
            JOIN categorias_repertorio cr ON mc.categoria_id = cr.id
            WHERE mc.musica_id = ?
            """,
            [m_id]
        )
        db_cats = [cr[0] for cr in cats_res.rows]
        if not db_cats and r[15]:
            db_cats = parse_categorias(r[15])
        
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
            "link": r[13] or "",
            "tags": r[14] or "",
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
            
        # Lê coluna ARTISTA se existir, senão extrai de parênteses no Nome da Música "Meu Mestre (Irmão Lázaro)"
        artista = sanitize_str(row[col_map["artista"]]) if col_map["artista"] else ""
        import re
        match_artist = re.search(r'\((.*?)\)', nome)
        if match_artist:
            if not artista:
                artista = match_artist.group(1).strip()
            # Limpa o nome da música removendo os parênteses
            nome = re.sub(r'\(.*?\)', '', nome).strip()
            
        # Monta os dados lidos do Excel (SEM misturar Categorias com Tema Central ou Tags!)
        excel_cats = parse_categorias(sanitize_str(row[col_map["categorias"]])) if col_map["categorias"] else []
                
        excel_data = {
            "nome_musica": nome,
            "artista": artista,
            "codigo": sanitize_str(row[col_map["codigo"]]) if col_map["codigo"] else "",
            "primeira_linha": sanitize_str(row[col_map["primeira_linha"]]) if col_map["primeira_linha"] else "",
            "versao_parecida": sanitize_str(row[col_map["versao_parecida"]]) if col_map["versao_parecida"] else "",
            "tema_central": sanitize_str(row[col_map["tema_central"]]) if col_map["tema_central"] else "",
            "categorias": excel_cats,
            "tags": sanitize_str(row[col_map["tags"]]) if col_map["tags"] else "",
            "cifra": sanitize_str(row[col_map["cifra"]]) if col_map["cifra"] else "",
            "tom": sanitize_str(row[col_map["tom"]]) if col_map["tom"] else "",
            "primeira_nota": sanitize_str(row[col_map["primeira_nota"]]) if col_map["primeira_nota"] else "",
            "versao_vocal": sanitize_str(row[col_map["versao_vocal"]]) if col_map["versao_vocal"] else "",
            "compasso": sanitize_str(row[col_map["compasso"]]) if col_map["compasso"] else "",
            "bpm": sanitize_str(row[col_map["bpm"]]) if col_map["bpm"] else "",
            "link": sanitize_str(row[col_map["link"]]) if col_map["link"] else "",
        }
        
        # Procura no banco de dados
        search_key = f"{normalize(nome)}||{normalize(artista)}"
        db_match = db_search_index.get(search_key)
        
        if not db_match:
            # Tenta encontrar só pelo nome
            db_match = next((v for v in db_musics_dict.values() if normalize(v["nome_musica"]) == normalize(nome)), None)
            
        errors = []
        if db_match:
            status = "update"
            preview_items.append({
                "status": status,
                "errors": errors,
                "excel_data": excel_data,
                "db_data": db_match
            })
        else:
            status = "new"
            if not excel_data["categorias"]:
                errors.append("Música nova sem Categoria (ex: agitadas1, lentas2, ceia)")
                status = "error"
            if not excel_data["tema_central"]:
                errors.append("Música nova sem Tema Central (ex: Adoração, Comunhão, Cruz)")
                status = "error"
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
    escopo: str = "pessoal",
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db)
):
    target_user_id = _resolve_target_user_id(current_user, escopo)
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
                "versao_vocal", "compasso", "bpm", "cifra", "versao_parecida", "tema_central", "link", "tags"]
                
        if db:
            for k in keys:
                val_excel = excel.get(k, "")
                val_db = db.get(k, "")
                
                if payload.fonte_verdade == "excel":
                    final_data[k] = val_excel if val_excel != "" else val_db
                else:
                    final_data[k] = val_db if val_db != "" else val_excel
                    
            if payload.fonte_verdade == "excel":
                final_cats = excel.get("categorias", []) if excel.get("categorias") else db.get("categorias", [])
            else:
                final_cats = db.get("categorias", []) if db.get("categorias") else excel.get("categorias", [])
        else:
            for k in keys:
                final_data[k] = excel.get(k, "")
            final_cats = excel.get("categorias", [])

        if not final_cats:
            final_cats = ["Geral"]

        # Se for música nova e tags estiver vazio, usa o tema_central como tag inicial (sem misturar com categorias!)
        tags_str = final_data["tags"]
        if not tags_str and final_data["tema_central"]:
            tags_str = final_data["tema_central"].lower()

        categoria_str = ", ".join([c.strip() for c in final_cats if c.strip()])

        try:
            if status == "update" and db:
                # Faz update preservando tags, categoria e demais campos conforme fonte da verdade
                if target_user_id is None:
                    await client.execute(
                        """
                        UPDATE biblioteca_busca SET
                            nome_musica = ?, artista = ?, tags = ?, link = ?, categoria = ?, codigo = ?, primeira_linha = ?,
                            tom = ?, primeira_nota = ?, versao_vocal = ?, compasso = ?, bpm = ?,
                            cifra = ?, versao_parecida = ?, tema_central = ?
                        WHERE id = ? AND usuario_id IS NULL
                        """,
                        [final_data["nome_musica"], final_data["artista"], tags_str, final_data["link"], categoria_str, final_data["codigo"], final_data["primeira_linha"],
                         final_data["tom"], final_data["primeira_nota"], final_data["versao_vocal"], final_data["compasso"], final_data["bpm"],
                         final_data["cifra"], final_data["versao_parecida"], final_data["tema_central"], db["id"]]
                    )
                else:
                    await client.execute(
                        """
                        UPDATE biblioteca_busca SET
                            nome_musica = ?, artista = ?, tags = ?, link = ?, categoria = ?, codigo = ?, primeira_linha = ?,
                            tom = ?, primeira_nota = ?, versao_vocal = ?, compasso = ?, bpm = ?,
                            cifra = ?, versao_parecida = ?, tema_central = ?
                        WHERE id = ? AND usuario_id = ?
                        """,
                        [final_data["nome_musica"], final_data["artista"], tags_str, final_data["link"], categoria_str, final_data["codigo"], final_data["primeira_linha"],
                         final_data["tom"], final_data["primeira_nota"], final_data["versao_vocal"], final_data["compasso"], final_data["bpm"],
                         final_data["cifra"], final_data["versao_parecida"], final_data["tema_central"], db["id"], target_user_id]
                    )
                musica_id = db["id"]
                updated += 1
                
                # Só recria musica_categorias se houver categorias definidas
                if final_cats:
                    await client.execute("DELETE FROM musica_categorias WHERE musica_id = ?", [musica_id])
                
            elif status == "new":
                res = await client.execute(
                    """
                    INSERT INTO biblioteca_busca (
                        nome_musica, artista, tags, link, categoria, codigo, primeira_linha, tom, primeira_nota,
                        versao_vocal, compasso, bpm, cifra, versao_parecida, tema_central, usuario_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    [final_data["nome_musica"], final_data["artista"], tags_str, final_data["link"], categoria_str, final_data["codigo"], final_data["primeira_linha"],
                     final_data["tom"], final_data["primeira_nota"], final_data["versao_vocal"], final_data["compasso"], final_data["bpm"],
                     final_data["cifra"], final_data["versao_parecida"], final_data["tema_central"], target_user_id]
                )
                musica_id = res.last_insert_rowid
                inserted += 1

            # Sincroniza as Categorias na tabela associativa
            for cat_nome in final_cats:
                cat_nome_clean = cat_nome.strip()
                if not cat_nome_clean:
                    continue
                cat_id = await find_or_create_categoria(client, cat_nome_clean, target_user_id)
                await client.execute(
                    "INSERT OR IGNORE INTO musica_categorias (musica_id, categoria_id) VALUES (?, ?)",
                    [musica_id, cat_id]
                )

        except Exception as e:
            print(f"Erro ao salvar musica {final_data.get('nome_musica')}: {e}")
            pass

    return {"message": f"Importação concluída. {inserted} inseridas, {updated} atualizadas.", "inserted": inserted, "updated": updated}


# ==============================================================================
# EDIÇÃO EM MASSA VIA EXCEL (EXPORTAÇÃO PROTEGIDA, PREVIEW DE DIFERENÇAS E COMMIT)
# ==============================================================================

async def _fetch_user_musics_map(client: libsql_client.Client, user_id: Optional[int]) -> Dict[int, Dict[str, Any]]:
    if user_id is None:
        res = await client.execute(
            """
            SELECT id, nome_musica, artista, codigo, primeira_linha, tom, primeira_nota, 
                   versao_vocal, compasso, bpm, cifra, versao_parecida, tema_central, link, tags, categoria
            FROM biblioteca_busca WHERE usuario_id IS NULL
            """
        )
        cats_all = await client.execute(
            """
            SELECT mc.musica_id, cr.nome
            FROM musica_categorias mc
            JOIN categorias_repertorio cr ON mc.categoria_id = cr.id
            JOIN biblioteca_busca bb ON mc.musica_id = bb.id
            WHERE bb.usuario_id IS NULL
            """
        )
    else:
        res = await client.execute(
            """
            SELECT id, nome_musica, artista, codigo, primeira_linha, tom, primeira_nota, 
                   versao_vocal, compasso, bpm, cifra, versao_parecida, tema_central, link, tags, categoria
            FROM biblioteca_busca WHERE usuario_id = ?
            """,
            [user_id]
        )
        cats_all = await client.execute(
            """
            SELECT mc.musica_id, cr.nome
            FROM musica_categorias mc
            JOIN categorias_repertorio cr ON mc.categoria_id = cr.id
            JOIN biblioteca_busca bb ON mc.musica_id = bb.id
            WHERE bb.usuario_id = ?
            """,
            [user_id]
        )
    cats_by_music: Dict[int, List[str]] = {}
    for row in cats_all.rows:
        mid = row[0]
        cats_by_music.setdefault(mid, []).append(row[1])

    db_map: Dict[int, Dict[str, Any]] = {}
    for r in res.rows:
        m_id = r[0]
        db_cats = cats_by_music.get(m_id, [])
        if not db_cats and r[15]:
            db_cats = parse_categorias(r[15])
        db_map[m_id] = {
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
            "link": r[13] or "",
            "tags": r[14] or "",
            "categorias": db_cats,
            "categorias_str": ", ".join(db_cats),
        }
    return db_map


@router.post("/bulk-export")
async def bulk_export_excel(
    payload: BulkExportRequest,
    escopo: str = "pessoal",
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db)
):
    if not payload.musica_ids:
        raise HTTPException(status_code=400, detail="Selecione pelo menos uma música para exportar.")
    valid_campos = [c for c in payload.campos if c in BULK_FIELDS_META]
    if not valid_campos:
        raise HTTPException(status_code=400, detail="Selecione pelo menos um campo válido para editar em massa.")

    target_user_id = _resolve_target_user_id(current_user, escopo)
    db_map = await _fetch_user_musics_map(client, target_user_id)

    # Preserva a ordem enviada pelo frontend (ou filtra apenas IDs pertencentes ao escopo)
    selected_songs = [db_map[mid] for mid in payload.musica_ids if mid in db_map]
    if not selected_songs:
        raise HTTPException(status_code=404, detail="Nenhuma das músicas selecionadas foi encontrada.")

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Edição em Massa LeviHub"

    # Construção dos cabeçalhos: 3 colunas fixas de referência + pares [CAMPO ATUAL, CAMPO NOVO]
    headers = ["ID", "MÚSICA (Ref.)", "ARTISTA (Ref.)"]
    col_types = ["ref", "ref", "ref"]  # "ref", "atual", "novo"
    for campo in valid_campos:
        h_label = BULK_FIELDS_META[campo]["header"]
        headers.append(f"{h_label} ATUAL")
        col_types.append("atual")
        headers.append(f"{h_label} NOVO")
        col_types.append("novo")

    total_cols = len(headers)

    # Linha 1: Banner de instruções
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=total_cols)
    banner_cell = ws.cell(row=1, column=1)
    banner_cell.value = (
        "📝 EDIÇÃO EM MASSA LEVIHUB — Preencha APENAS as colunas verdes ('... NOVO'). "
        "As demais colunas estão bloqueadas para segurança. Deixe em branco nas músicas que NÃO quiser alterar."
    )
    banner_cell.font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    banner_cell.fill = PatternFill(start_color="1E272E", end_color="1E272E", fill_type="solid")
    banner_cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
    banner_cell.protection = Protection(locked=True)
    ws.row_dimensions[1].height = 30

    # Estilos
    thin_side = Side(style="thin", color="D0D7DE")
    border_locked = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)
    green_side = Side(style="thin", color="27AE60")
    border_editable = Border(left=green_side, right=green_side, top=green_side, bottom=green_side)

    fill_header_ref = PatternFill(start_color="2C3E50", end_color="2C3E50", fill_type="solid")
    fill_header_atual = PatternFill(start_color="576574", end_color="576574", fill_type="solid")
    fill_header_novo = PatternFill(start_color="27AE60", end_color="27AE60", fill_type="solid")

    fill_cell_locked = PatternFill(start_color="F1F2F6", end_color="F1F2F6", fill_type="solid")
    fill_cell_novo = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")

    font_header = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    font_cell_ref = Font(name="Calibri", size=10, bold=True, color="2C3E50")
    font_cell_atual = Font(name="Calibri", size=10, color="576574")
    font_cell_novo = Font(name="Calibri", size=10, bold=True, color="1E272E")

    # Linha 2: Cabeçalhos das colunas
    ws.row_dimensions[2].height = 28
    for col_idx, (h_text, c_type) in enumerate(zip(headers, col_types), start=1):
        cell = ws.cell(row=2, column=col_idx, value=h_text)
        cell.font = font_header
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = border_locked
        cell.protection = Protection(locked=True)
        if c_type == "ref":
            cell.fill = fill_header_ref
        elif c_type == "atual":
            cell.fill = fill_header_atual
        else:
            cell.fill = fill_header_novo

    # Linhas 3+: Dados das músicas selecionadas
    for row_offset, song in enumerate(selected_songs):
        row_num = 3 + row_offset
        ws.row_dimensions[row_num].height = 22

        row_values = [song["id"], song["nome_musica"], song["artista"]]
        for campo in valid_campos:
            if campo == "categorias":
                atual_val = song["categorias_str"]
            else:
                atual_val = song.get(campo, "") or ""
            row_values.append(atual_val)
            row_values.append("")  # Coluna NOVO começa vazia para o usuário preencher apenas o que quiser mudar

        for col_idx, (val, c_type) in enumerate(zip(row_values, col_types), start=1):
            cell = ws.cell(row=row_num, column=col_idx, value=val)
            cell.alignment = Alignment(
                horizontal="center" if col_idx == 1 else "left",
                vertical="center",
                wrap_text=False
            )
            if c_type in ("ref", "atual"):
                cell.fill = fill_cell_locked
                cell.font = font_cell_ref if c_type == "ref" else font_cell_atual
                cell.border = border_locked
                cell.protection = Protection(locked=True)
            else:
                cell.fill = fill_cell_novo
                cell.font = font_cell_novo
                cell.border = border_editable
                cell.protection = Protection(locked=False)

    # Ajusta larguras das colunas automaticamente
    for col_idx, c_type in enumerate(col_types, start=1):
        col_letter = get_column_letter(col_idx)
        if col_idx == 1:
            ws.column_dimensions[col_letter].width = 9
        elif col_idx == 2:
            ws.column_dimensions[col_letter].width = 34
        elif col_idx == 3:
            ws.column_dimensions[col_letter].width = 24
        else:
            ws.column_dimensions[col_letter].width = 28

    # Congela cabeçalhos e colunas de referência
    ws.freeze_panes = "D3"

    # Ativa proteção de planilha (bloqueia todas as células exceto as que têm Protection(locked=False))
    ws.protection.sheet = True
    ws.protection.formatColumns = False
    ws.protection.formatRows = False
    ws.protection.selectLockedCells = False
    ws.protection.selectUnlockedCells = False

    output = io.BytesIO()
    wb.save(output)
    excel_bytes = output.getvalue()

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="Edicao_Em_Massa_LeviHub.xlsx"'
        }
    )


@router.post("/bulk-preview")
async def bulk_preview_excel(
    file: UploadFile = File(...),
    escopo: str = "pessoal",
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db)
):
    if not file.filename.lower().endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Formato inválido. Envie um arquivo Excel (.xlsx ou .xls).")

    try:
        contents = await file.read()
        df_raw = pd.read_excel(io.BytesIO(contents), header=None)

        header_idx = 0
        for idx, row in df_raw.iterrows():
            row_str = " ".join([str(c).upper() for c in row if not pd.isna(c)])
            if ("ATUAL" in row_str and "NOVO" in row_str) or ("MÚSICA (REF.)" in row_str):
                header_idx = idx
                break

        df = pd.read_excel(io.BytesIO(contents), header=header_idx)
        df.columns = [str(c).strip().upper() for c in df.columns]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao ler a planilha de edição em massa: {str(e)}")

    # Identifica colunas '... NOVO' e mapeia para os campos do banco
    header_to_field = {meta["header"].upper(): field_key for field_key, meta in BULK_FIELDS_META.items()}
    novo_cols_map: Dict[str, str] = {}  # field_key -> column_name_in_df

    for col_name in df.columns:
        if col_name.endswith(" NOVO"):
            base_header = col_name[:-5].strip()
            if base_header in header_to_field:
                novo_cols_map[header_to_field[base_header]] = col_name

    if not novo_cols_map:
        raise HTTPException(
            status_code=400,
            detail="Nenhuma coluna '... NOVO' foi encontrada na planilha. Utilize a planilha gerada na Etapa 1 da Edição em Massa."
        )

    id_col = next((c for c in df.columns if c == "ID"), None)
    nome_ref_col = next((c for c in df.columns if "MÚSICA" in c or "NOME DA MÚSICA" in c), None)

    target_user_id = _resolve_target_user_id(current_user, escopo)
    db_map = await _fetch_user_musics_map(client, target_user_id)
    db_by_name = {m["nome_musica"].strip().lower(): m for m in db_map.values()}

    changed_items = []
    total_rows = 0

    for _, row in df.iterrows():
        db_song = None
        if id_col and not pd.isna(row[id_col]):
            try:
                mid = int(float(str(row[id_col]).strip()))
                db_song = db_map.get(mid)
            except Exception:
                pass

        if not db_song and nome_ref_col and not pd.isna(row[nome_ref_col]):
            nome_lookup = sanitize_str(row[nome_ref_col]).lower()
            db_song = db_by_name.get(nome_lookup)

        if not db_song:
            continue

        total_rows += 1
        song_changes = []

        for field_key, col_novo in novo_cols_map.items():
            raw_new = sanitize_str(row[col_novo])
            if raw_new == "":
                # Em branco = usuário não quis alterar este campo nesta música
                continue

            is_clear_cmd = raw_new.upper() in ("[LIMPAR]", "[VAZIO]", "-")
            new_val_clean = "" if is_clear_cmd else raw_new

            meta = BULK_FIELDS_META[field_key]
            label = meta["label"]

            if field_key == "categorias":
                old_cats = db_song["categorias"]
                new_cats = parse_categorias(new_val_clean)
                if not new_cats:
                    continue
                old_norm = [c.lower() for c in old_cats]
                new_norm = [c.lower() for c in new_cats]
                if old_norm == new_norm:
                    continue
                old_display = ", ".join(old_cats) if old_cats else "Vazio"
                new_display = ", ".join(new_cats)
                song_changes.append({
                    "field": field_key,
                    "label": label,
                    "old_value": old_display,
                    "new_value": new_display,
                    "message": f'Música "{db_song["nome_musica"]}" mudará de {label} de "{old_display}" para "{new_display}"'
                })
            else:
                old_val = str(db_song.get(field_key, "") or "").strip()
                if old_val.lower() == new_val_clean.lower() and old_val == new_val_clean:
                    continue
                if old_val == new_val_clean:
                    continue
                old_display = old_val if old_val else "Vazio"
                new_display = new_val_clean if new_val_clean else "Vazio"
                song_changes.append({
                    "field": field_key,
                    "label": label,
                    "old_value": old_display,
                    "new_value": new_val_clean,
                    "message": f'Música "{db_song["nome_musica"]}" mudará de {label} de "{old_display}" para "{new_display}"'
                })

        if song_changes:
            changed_items.append({
                "musica_id": db_song["id"],
                "nome_musica": db_song["nome_musica"],
                "artista": db_song["artista"],
                "changes": song_changes
            })

    return {
        "items": changed_items,
        "total_linhas_analisadas": total_rows,
        "campos_detectados": [BULK_FIELDS_META[fk]["label"] for fk in novo_cols_map.keys()]
    }


@router.post("/bulk-commit")
async def bulk_commit_excel(
    payload: BulkCommitRequest,
    escopo: str = "pessoal",
    current_user: dict = Depends(get_current_user),
    client: libsql_client.Client = Depends(get_db)
):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Nenhuma alteração selecionada para aplicar.")

    target_user_id = _resolve_target_user_id(current_user, escopo)
    updated_songs = 0
    total_changes = 0

    allowed_db_cols = {
        "tema_central", "tags", "tom", "primeira_nota", "primeira_linha",
        "nome_musica", "artista", "codigo", "link", "versao_vocal",
        "compasso", "bpm", "versao_parecida", "cifra"
    }

    for item in payload.items:
        musica_id = item.get("musica_id")
        changes = item.get("changes", [])
        if not musica_id or not changes:
            continue

        # Verifica se a música pertence ao escopo selecionado
        if target_user_id is None:
            check = await client.execute(
                "SELECT id FROM biblioteca_busca WHERE id = ? AND usuario_id IS NULL",
                [musica_id]
            )
        else:
            check = await client.execute(
                "SELECT id FROM biblioteca_busca WHERE id = ? AND usuario_id = ?",
                [musica_id, target_user_id]
            )
        if not check.rows:
            continue

        set_clauses = []
        set_values = []
        new_cats_list: Optional[List[str]] = None

        for ch in changes:
            field = ch.get("field")
            new_val = str(ch.get("new_value", "")).strip()
            if field == "categorias":
                new_cats_list = parse_categorias(new_val)
                if new_cats_list:
                    set_clauses.append("categoria = ?")
                    set_values.append(", ".join(new_cats_list))
                    total_changes += 1
            elif field in allowed_db_cols:
                set_clauses.append(f"{field} = ?")
                set_values.append(new_val)
                total_changes += 1

        try:
            if set_clauses:
                if target_user_id is None:
                    sql = f"UPDATE biblioteca_busca SET {', '.join(set_clauses)} WHERE id = ? AND usuario_id IS NULL"
                    await client.execute(sql, set_values + [musica_id])
                else:
                    sql = f"UPDATE biblioteca_busca SET {', '.join(set_clauses)} WHERE id = ? AND usuario_id = ?"
                    await client.execute(sql, set_values + [musica_id, target_user_id])

            if new_cats_list:
                await client.execute("DELETE FROM musica_categorias WHERE musica_id = ?", [musica_id])
                for cat_nome in new_cats_list:
                    cat_clean = cat_nome.strip()
                    if not cat_clean:
                        continue
                    cat_id = await find_or_create_categoria(client, cat_clean, target_user_id)
                    await client.execute(
                        "INSERT OR IGNORE INTO musica_categorias (musica_id, categoria_id) VALUES (?, ?)",
                        [musica_id, cat_id]
                    )

            updated_songs += 1
        except Exception as e:
            print(f"Erro ao atualizar em massa música ID {musica_id}: {e}")

    return {
        "message": f"Edição em massa concluída! {updated_songs} música(s) atualizada(s) ({total_changes} alteração(ões) aplicada(s)).",
        "updated": updated_songs,
        "total_changes": total_changes
    }

