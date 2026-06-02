# arquivo: api/models.py
# Todos os modelos Pydantic (schemas de request/response) da aplicação.

from pydantic import BaseModel
from typing import List, Optional


# =============================================================================
# AUTENTICAÇÃO
# =============================================================================

class UserCreate(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class VerifyRequest(BaseModel):
    email: str
    codigo: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    codigo: str
    nova_senha: str


# =============================================================================
# USUÁRIO / PERFIL
# =============================================================================

class ConfigRequest(BaseModel):
    usar_banco_padrao: Optional[bool] = None
    funcoes_padrao: Optional[str] = None

class UpdateCredentialsRequest(BaseModel):
    novo_email: Optional[str] = None
    nova_senha: Optional[str] = None


# =============================================================================
# EQUIPE (MEMBROS E FUNÇÕES)
# =============================================================================

class MembroRequest(BaseModel):
    nome: str
    telefone: Optional[str] = ""
    email: Optional[str] = ""
    status: Optional[str] = "ativo"
    funcoes: List[str] = []

class FuncaoRequest(BaseModel):
    nome: str
    membros_ids: Optional[List[int]] = []
    permitidas_acumular: Optional[List[str]] = []
    obrigatorias_acumular: Optional[List[str]] = []


# =============================================================================
# CATEGORIAS DO REPERTÓRIO
# =============================================================================

class CategoriaRequest(BaseModel):
    nome: str


# =============================================================================
# MÚSICAS / REPERTÓRIO
# =============================================================================

class NovaMusicaRequest(BaseModel):
    nome_musica: str
    artista: Optional[str] = ""
    tags: str
    categorias: List[str]  # Lista de nomes de categorias
    link: Optional[str] = ""

class EditaMusicaRequest(BaseModel):
    nome_musica: str
    artista: Optional[str] = ""
    tags: str
    categorias: List[str]  # Lista de nomes de categorias
    link: Optional[str] = ""

class SugestaoRequest(BaseModel):
    usuario: str
    sugestao: str


# =============================================================================
# ADMIN
# =============================================================================

class NovaMusicaGlobalRequest(BaseModel):
    nome_musica: str
    artista: Optional[str] = ""
    tags: str
    categorias: List[str]  # Lista de nomes de categorias (ex: ["agitadas1", "ceia"])
    link: Optional[str] = ""

class AdminUpdateUser(BaseModel):
    email: Optional[str] = None
    senha: Optional[str] = None
    role: Optional[str] = None


# =============================================================================
# TRANSPOSITOR
# =============================================================================

class TransposeCifraRequest(BaseModel):
    cifra_text: str
    action: str
    interval: float

class TransposeCifraResponse(BaseModel):
    transposed_cifra: str

class TransposeSequenceRequest(BaseModel):
    chords: List[str]
    action: str
    interval: float

class TransposeSequenceResponse(BaseModel):
    original_chords: List[str]
    transposed_chords: List[str]
    explanations: List[str]


# =============================================================================
# ESCALAS: DISPONIBILIDADES E VAGAS
# =============================================================================

class DisponibilidadesRequest(BaseModel):
    mes: int
    ano: int
    # Ex: { "1_1-3-2026": True, "2_5-3-2026": True }
    # Chave = f"{membro_id}_{formatDataKey(data)}", valor = True quando indisponível
    indisponibilidades: dict

class VagasConfigRequest(BaseModel):
    mes: int
    ano: int
    # Ex: { "1-3-2026": [{ "id": "1", "label": "Voz e violão", "aceita": ["Voz e violão"] }] }
    vagas_por_dia: dict

class RegrasConfigRequest(BaseModel):
    mes: int
    ano: int
    regras: list



# =============================================================================
# ROBOTO: CONTEXTO DE BUSCA
# =============================================================================

class RobotoContextoRequest(BaseModel):
    ultima_busca: str = ""
    tipo_busca: str = "palavra"   # "palavra" | "artista" | "categoria"
