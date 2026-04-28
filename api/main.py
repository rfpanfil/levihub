# arquivo: api/main.py
# Ponto de entrada da aplicação FastAPI.
# Inicializa o banco de dados via lifespan e registra todos os routers.
#
# Comando de start:
#   Desenvolvimento: uvicorn api.main:app --reload
#   Produção (Render): uvicorn api.main:app --host 0.0.0.0 --port $PORT

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import database
from api.config import TURSO_URL, TURSO_TOKEN
from api.routers import auth, usuario, equipe, musicas, transpor, categorias, admin


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

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",          # Desenvolvimento local
        "https://levihub.vercel.app",     # Produção (Vercel)
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
