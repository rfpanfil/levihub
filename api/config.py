# arquivo: api/config.py
# Centraliza todas as variáveis de ambiente e constantes da aplicação.
# Usa python-dotenv se disponível (desenvolvimento local), caso contrário
# lê diretamente do ambiente (produção no Render, onde as vars são injetadas).

import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # Produção: variáveis já são injetadas pelo ambiente (Render)

# --- Banco de Dados (Turso) ---
TURSO_URL: str = os.getenv("TURSO_DATABASE_URL", "")
TURSO_TOKEN: str = os.getenv("TURSO_AUTH_TOKEN", "")

# --- Segurança (JWT) ---
SECRET_KEY: str = os.getenv("SECRET_KEY", "uma_chave_secreta_super_segura_aqui_para_desenvolvimento")
ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # Token dura 7 dias

# --- E-mail (SMTP Gmail) ---
SMTP_EMAIL: str | None = os.getenv("SMTP_EMAIL")
SMTP_PASSWORD: str | None = os.getenv("SMTP_PASSWORD")

# --- Google Sheets (Sugestões) ---
GOOGLE_CREDENTIALS: str | None = os.getenv("GOOGLE_CREDENTIALS")
