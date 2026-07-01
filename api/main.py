# arquivo: api/main.py
# Ponto de entrada da aplicação FastAPI.
# Inicializa o banco de dados via lifespan e registra todos os routers.
#
# Comando de start:
#   Desenvolvimento: uvicorn api.main:app --reload
#   Produção (Render): uvicorn api.main:app --host 0.0.0.0 --port $PORT

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from api.limiter import limiter

from api import database
from api.config import TURSO_URL, TURSO_TOKEN
from api.routers import auth, usuario, equipe, musicas, transpor, categorias, admin, escalas_config, roboto_config, upload


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gerencia o ciclo de vida da aplicação: abre e fecha a conexão com o banco."""
    # STARTUP: inicializa o cliente Turso singleton e roda as migrations
    await database.init_db(url=TURSO_URL, auth_token=TURSO_TOKEN)
    await database.run_migrations()
    print("✅ Banco de dados inicializado e migrations executadas.")
    yield
    # SHUTDOWN: fecha o cliente singleton
    await database.close_db()
    print("🔒 Conexão com o banco de dados encerrada.")


# --- Criação do App ---
app = FastAPI(
    title="LeviHub API",
    description="API de gestão de louvor: transpositor, escalas, repertório e equipe.",
    version="2.0.0",
    lifespan=lifespan,
)

@app.api_route("/ping", methods=["GET", "HEAD"], tags=["Health"])
def ping():
    """Rota para o UptimeRobot manter o servidor Render acordado."""
    return {"status": "ok"}

# --- Rate Limiting ---
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",          # Desenvolvimento local
        "http://localhost:5174",          # Desenvolvimento local (alternativa)
        "http://127.0.0.1:5173",          # Desenvolvimento local (IP)
        "https://levihub.vercel.app",     # Produção (Vercel)
        os.getenv("FRONTEND_URL", ""),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Registro dos Routers ---
app.include_router(auth.router)
app.include_router(usuario.router)
app.include_router(equipe.router)
app.include_router(musicas.router)
app.include_router(transpor.router)
app.include_router(categorias.router)
app.include_router(admin.router)
app.include_router(escalas_config.router)
app.include_router(roboto_config.router)
app.include_router(upload.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
