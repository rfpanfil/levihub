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
