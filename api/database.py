# arquivo: api/database.py
#
# Gerencia a conexão com o banco de dados Turso (LibSQL).
#
# SINGLETON: cliente criado uma vez no startup via lifespan, fechado no shutdown.
# Os endpoints recebem o cliente via Depends(get_db).

import libsql_client
from typing import Optional

# --- Instância Singleton ---
_client: Optional[libsql_client.Client] = None


def get_db() -> libsql_client.Client:
    """Dependency do FastAPI. Retorna o cliente Turso singleton."""
    if _client is None:
        raise RuntimeError(
            "Banco de dados não inicializado. "
            "Certifique-se de que o lifespan do FastAPI foi executado."
        )
    return _client


async def init_db(url: str, auth_token: str) -> None:
    """Cria o cliente singleton. Chamado UMA VEZ no startup via lifespan."""
    global _client
    _client = libsql_client.create_client(url=url, auth_token=auth_token)


async def close_db() -> None:
    """Fecha o cliente singleton. Chamado UMA VEZ no shutdown via lifespan."""
    global _client
    if _client is not None:
        await _client.close()
        _client = None


# =============================================================================
# HELPER: find_or_create_categoria
# Compartilhado entre musicas.py e admin.py.
# =============================================================================

async def find_or_create_categoria(
    client: libsql_client.Client,
    cat_nome: str,
    usuario_id: Optional[int],
) -> int:
    """
    Encontra ou cria uma categoria em categorias_repertorio.
    usuario_id=None indica categoria global (banco padrão).
    Retorna o ID da categoria.
    """
    if usuario_id is None:
        res = await client.execute(
            "SELECT id FROM categorias_repertorio WHERE LOWER(nome) = LOWER(?) AND usuario_id IS NULL",
            [cat_nome],
        )
    else:
        res = await client.execute(
            "SELECT id FROM categorias_repertorio WHERE LOWER(nome) = LOWER(?) AND usuario_id = ?",
            [cat_nome, usuario_id],
        )

    if res.rows:
        return res.rows[0][0]

    ins = await client.execute(
        "INSERT INTO categorias_repertorio (nome, usuario_id) VALUES (?, ?)",
        [cat_nome, usuario_id],
    )
    return ins.last_insert_rowid


# =============================================================================
# MIGRAÇÃO DE DADOS: CSV categoria → musica_categorias (one-time, idempotente)
# =============================================================================

async def _migrate_categorias_para_relacional() -> None:
    """
    Lê a coluna categoria (CSV) de cada música e popula musica_categorias.
    Chamada apenas quando musica_categorias está vazia e há músicas com categorias.
    """
    client = _client
    musicas = await client.execute(
        "SELECT id, categoria, usuario_id FROM biblioteca_busca "
        "WHERE categoria IS NOT NULL AND categoria != ''"
    )

    migradas = 0
    for row in musicas.rows:
        musica_id, cat_str, usuario_id = row[0], row[1], row[2]
        cats = [c.strip() for c in cat_str.split(",") if c.strip()]

        for cat_nome in cats:
            cat_id = await find_or_create_categoria(client, cat_nome, usuario_id)
            await client.execute(
                "INSERT OR IGNORE INTO musica_categorias (musica_id, categoria_id) VALUES (?, ?)",
                [musica_id, cat_id],
            )
        migradas += 1

    print(f"✅ Migração de categorias concluída: {migradas} músicas processadas.")


# =============================================================================
# MIGRATIONS
# =============================================================================

async def run_migrations() -> None:
    """
    Executa todas as migrações de schema do banco de dados.
    Idempotente: seguro de rodar múltiplas vezes.
    """
    client = _client

    # -------------------------------------------------------------------------
    # CRIAÇÃO DAS TABELAS PRINCIPAIS (CREATE TABLE IF NOT EXISTS)
    # -------------------------------------------------------------------------

    await client.execute("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL,
            usar_banco_padrao BOOLEAN DEFAULT 1
        )
    """)

    await client.execute("""
        CREATE TABLE IF NOT EXISTS membros (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            telefone TEXT DEFAULT '',
            email TEXT DEFAULT '',
            status TEXT DEFAULT 'ativo',
            usuario_id INTEGER
        )
    """)

    # funcoes: criada sem UNIQUE em nome pois a constraint correta
    # será imposta pelos índices parciais na migração abaixo.
    await client.execute("""
        CREATE TABLE IF NOT EXISTS funcoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            usuario_id INTEGER
        )
    """)

    await client.execute("""
        CREATE TABLE IF NOT EXISTS membro_funcoes (
            membro_id INTEGER NOT NULL,
            funcao_id INTEGER NOT NULL,
            PRIMARY KEY (membro_id, funcao_id)
        )
    """)

    await client.execute("""
        CREATE TABLE IF NOT EXISTS biblioteca_busca (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome_musica TEXT NOT NULL,
            tags TEXT DEFAULT '',
            usuario_id INTEGER,
            link TEXT DEFAULT '',
            categoria TEXT DEFAULT '',
            artista TEXT DEFAULT ''
        )
    """)

    await client.execute("""
        CREATE TABLE IF NOT EXISTS categorias_repertorio (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            usuario_id INTEGER
        )
    """)

    # -------------------------------------------------------------------------
    # NOVA TABELA: musica_categorias (Débito Técnico #3)
    # -------------------------------------------------------------------------
    await client.execute("""
        CREATE TABLE IF NOT EXISTS musica_categorias (
            musica_id   INTEGER NOT NULL,
            categoria_id INTEGER NOT NULL,
            PRIMARY KEY (musica_id, categoria_id)
        )
    """)

    # -------------------------------------------------------------------------
    # NOVAS TABELAS: persistência de configuração de escalas
    # Uma linha por (usuario_id, mes_ano) com o payload JSON completo.
    # O UNIQUE viabiliza o ON CONFLICT DO UPDATE (upsert) no router.
    # -------------------------------------------------------------------------
    await client.execute("""
        CREATE TABLE IF NOT EXISTS escala_disponibilidades (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id  INTEGER NOT NULL,
            mes_ano     TEXT NOT NULL,
            dados       TEXT NOT NULL DEFAULT '{}',
            UNIQUE(usuario_id, mes_ano)
        )
    """)

    await client.execute("""
        CREATE TABLE IF NOT EXISTS escala_vagas_config (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id  INTEGER NOT NULL,
            mes_ano     TEXT NOT NULL,
            dados       TEXT NOT NULL DEFAULT '{}',
            UNIQUE(usuario_id, mes_ano)
        )
    """)

    # -------------------------------------------------------------------------
    # NOVA TABELA: roboto_contexto
    # Persiste apenas o contexto de busca do LeviRoboto (última busca + tipo).
    # O histórico de chat permanece estritamente no localStorage do cliente.
    # UNIQUE(usuario_id) → uma linha por usuário, viabiliza upsert.
    # -------------------------------------------------------------------------
    await client.execute("""
        CREATE TABLE IF NOT EXISTS roboto_contexto (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id   INTEGER NOT NULL UNIQUE,
            ultima_busca TEXT    NOT NULL DEFAULT '',
            tipo_busca   TEXT    NOT NULL DEFAULT 'palavra'
        )
    """)

    # -------------------------------------------------------------------------
    # MIGRAÇÕES CUMULATIVAS (ALTER TABLE — tolerantes a falhas)
    # -------------------------------------------------------------------------
    _alter_migrations = [
        "ALTER TABLE usuarios ADD COLUMN funcoes_padrao TEXT DEFAULT 'Mídia,Voz e violão,Voz 1,Voz 2,Voz 3'",
        "ALTER TABLE usuarios ADD COLUMN is_verified BOOLEAN DEFAULT 1",
        "ALTER TABLE usuarios ADD COLUMN verification_code TEXT",
        "ALTER TABLE usuarios ADD COLUMN role TEXT DEFAULT 'user'",
        # Separa o token de recuperação de senha do código de verificação de conta
        "ALTER TABLE usuarios ADD COLUMN token_recuperacao TEXT",
        "ALTER TABLE membros ADD COLUMN usuario_id INTEGER",
        "ALTER TABLE funcoes ADD COLUMN usuario_id INTEGER",
        "ALTER TABLE biblioteca_busca ADD COLUMN usuario_id INTEGER",
        "ALTER TABLE biblioteca_busca ADD COLUMN link TEXT DEFAULT ''",
        "ALTER TABLE biblioteca_busca ADD COLUMN categoria TEXT DEFAULT ''",
        "ALTER TABLE biblioteca_busca ADD COLUMN artista TEXT DEFAULT ''",
    ]
    for sql in _alter_migrations:
        try:
            await client.execute(sql)
        except Exception:
            pass  # Coluna já existe — comportamento esperado

    # -------------------------------------------------------------------------
    # MIGRAÇÃO ESTRUTURAL: funcoes — adiciona índices parciais UNIQUE(nome, usuario_id)
    # (Débito Técnico #2 — resolve o hack do espaço invisível)
    #
    # SEGURO: NÃO dropa nem recria a tabela. O SQLite permite criar índices
    # diretamente na tabela existente, preservando todos os dados e as
    # referências em membro_funcoes.
    # -------------------------------------------------------------------------

    # Índices parciais (idempotentes via IF NOT EXISTS):
    # — Funções de usuário: UNIQUE(nome, usuario_id) para usuario_id IS NOT NULL
    try:
        await client.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS funcoes_nome_usuario
            ON funcoes(nome, usuario_id) WHERE usuario_id IS NOT NULL
        """)
    except Exception as e:
        # Pode falhar se houver nomes duplicados herdados do hack do espaço.
        # Nesse caso, limpa os duplicados mantendo apenas o primeiro registro.
        print(f"⚠️ Índice funcoes_nome_usuario: limpando duplicados antes de criar. ({e})")
        await client.execute("""
            DELETE FROM funcoes
            WHERE rowid NOT IN (
                SELECT MIN(rowid) FROM funcoes
                WHERE usuario_id IS NOT NULL
                GROUP BY TRIM(nome), usuario_id
            ) AND usuario_id IS NOT NULL
        """)
        await client.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS funcoes_nome_usuario
            ON funcoes(nome, usuario_id) WHERE usuario_id IS NOT NULL
        """)

    # — Funções globais: UNIQUE(nome) para usuario_id IS NULL
    try:
        await client.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS funcoes_nome_global
            ON funcoes(nome) WHERE usuario_id IS NULL
        """)
    except Exception as e:
        print(f"⚠️ Índice funcoes_nome_global: limpando duplicados globais. ({e})")
        await client.execute("""
            DELETE FROM funcoes
            WHERE rowid NOT IN (
                SELECT MIN(rowid) FROM funcoes
                WHERE usuario_id IS NULL
                GROUP BY TRIM(nome)
            ) AND usuario_id IS NULL
        """)
        await client.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS funcoes_nome_global
            ON funcoes(nome) WHERE usuario_id IS NULL
        """)

    print("✅ Índices de funcoes verificados/criados com sucesso.")

    # -------------------------------------------------------------------------
    # REPARO DE INTEGRIDADE: remove entradas órfãs de membro_funcoes
    # (membro_funcoes.funcao_id que não existem mais em funcoes)
    # Pode ocorrer se migração anterior tiver sido destrutiva.
    # -------------------------------------------------------------------------
    orphans = await client.execute("""
        SELECT COUNT(*) FROM membro_funcoes mf
        WHERE NOT EXISTS (SELECT 1 FROM funcoes f WHERE f.id = mf.funcao_id)
    """)
    orphan_count = orphans.rows[0][0] if orphans.rows else 0
    if orphan_count > 0:
        print(f"⚠️ Encontradas {orphan_count} referências órfãs em membro_funcoes. Removendo...")
        await client.execute("""
            DELETE FROM membro_funcoes
            WHERE NOT EXISTS (SELECT 1 FROM funcoes f WHERE f.id = funcao_id)
        """)

    # -------------------------------------------------------------------------
    # MIGRAÇÃO DE DADOS: CSV categoria → musica_categorias (one-time)
    # (Débito Técnico #3 — popula a nova tabela associativa)
    # -------------------------------------------------------------------------
    mc_count = await client.execute("SELECT COUNT(*) FROM musica_categorias")
    bb_count = await client.execute(
        "SELECT COUNT(*) FROM biblioteca_busca WHERE categoria IS NOT NULL AND categoria != ''"
    )
    if mc_count.rows[0][0] == 0 and bb_count.rows[0][0] > 0:
        await _migrate_categorias_para_relacional()
