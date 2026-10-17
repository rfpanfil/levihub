# arquivo: api/database.py
#
# Gerencia a conexo com o banco de dados Turso (LibSQL).
#
# SINGLETON: cliente criado uma vez no startup via lifespan, fechado no shutdown.
# Os endpoints recebem o cliente via Depends(get_db).

import libsql_client
from typing import Optional

# --- Instncia Singleton ---
_client: Optional[libsql_client.Client] = None


def get_db() -> libsql_client.Client:
    """Dependency do FastAPI. Retorna o cliente Turso singleton."""
    if _client is None:
        raise RuntimeError(
            "Banco de dados no inicializado. "
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
    usuario_id=None indica categoria global (banco padro).
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
# MIGRAO DE DADOS: CSV categoria  musica_categorias (one-time, idempotente)
# =============================================================================

async def _migrate_categorias_para_relacional() -> None:
    """
    L a coluna categoria (CSV) de cada msica e popula musica_categorias.
    Chamada apenas quando musica_categorias est vazia e h msicas com categorias.
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

    print(f" Migrao de categorias concluda: {migradas} msicas processadas.")


# =============================================================================
# MIGRATIONS
# =============================================================================

async def run_migrations() -> None:
    """
    Executa todas as migraes de schema do banco de dados.
    Idempotente: seguro de rodar mltiplas vezes.
    """
    client = _client

    # -------------------------------------------------------------------------
    # CRIAO DAS TABELAS PRINCIPAIS (CREATE TABLE IF NOT EXISTS)
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
    # ser imposta pelos ndices parciais na migrao abaixo.
    await client.execute("""
        CREATE TABLE IF NOT EXISTS funcoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            usuario_id INTEGER,
            permitidas_acumular TEXT DEFAULT '[]',
            obrigatorias_acumular TEXT DEFAULT '[]'
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
    # NOVA TABELA: musica_categorias (Dbito Tcnico #3)
    # -------------------------------------------------------------------------
    await client.execute("""
        CREATE TABLE IF NOT EXISTS musica_categorias (
            musica_id   INTEGER NOT NULL,
            categoria_id INTEGER NOT NULL,
            PRIMARY KEY (musica_id, categoria_id)
        )
    """)

    # -------------------------------------------------------------------------
    # NOVAS TABELAS: persistncia de configurao de escalas
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

    await client.execute("""
        CREATE TABLE IF NOT EXISTS escala_regras_config (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id  INTEGER NOT NULL,
            mes_ano     TEXT NOT NULL,
            dados       TEXT NOT NULL DEFAULT '[]',
            UNIQUE(usuario_id, mes_ano)
        )
    """)

    await client.execute("""
        CREATE TABLE IF NOT EXISTS escala_matriz_config (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id  INTEGER NOT NULL,
            mes_ano     TEXT NOT NULL,
            dados       TEXT NOT NULL DEFAULT '{}',
            UNIQUE(usuario_id, mes_ano)
        )
    """)

    # -------------------------------------------------------------------------
    # NOVA TABELA: roboto_contexto
    # Persiste apenas o contexto de busca do LeviRoboto (ltima busca + tipo).
    # O histrico de chat permanece estritamente no localStorage do cliente.
    # UNIQUE(usuario_id)  uma linha por usurio, viabiliza upsert.
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
    # NOVA TABELA: planejamento_periodos e planejamento_musicas
    # -------------------------------------------------------------------------
    await client.execute("""
        CREATE TABLE IF NOT EXISTS planejamento_periodos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            nome TEXT NOT NULL
        )
    """)

    await client.execute("""
        CREATE TABLE IF NOT EXISTS planejamento_musicas (
            periodo_id INTEGER NOT NULL,
            musica_id INTEGER NOT NULL,
            ordem INTEGER DEFAULT 0,
            PRIMARY KEY (periodo_id, musica_id)
        )
    """)

    # -------------------------------------------------------------------------
    # MIGRAES CUMULATIVAS (ALTER TABLE  tolerantes a falhas)
    # -------------------------------------------------------------------------
    _alter_migrations = [
        "ALTER TABLE usuarios ADD COLUMN funcoes_padrao TEXT DEFAULT 'Mdia,Voz e violo,Voz 1,Voz 2,Voz 3'",
        "ALTER TABLE usuarios ADD COLUMN is_verified BOOLEAN DEFAULT 1",
        "ALTER TABLE usuarios ADD COLUMN verification_code TEXT",
        "ALTER TABLE usuarios ADD COLUMN role TEXT DEFAULT 'user'",
        "ALTER TABLE usuarios ADD COLUMN slugs TEXT DEFAULT '[]'",
        # Separa o token de recuperao de senha do cdigo de verificao de conta
        "ALTER TABLE usuarios ADD COLUMN token_recuperacao TEXT",
        "ALTER TABLE membros ADD COLUMN usuario_id INTEGER",
        "ALTER TABLE funcoes ADD COLUMN usuario_id INTEGER",
        "ALTER TABLE funcoes ADD COLUMN permitidas_acumular TEXT DEFAULT '[]'",
        "ALTER TABLE funcoes ADD COLUMN obrigatorias_acumular TEXT DEFAULT '[]'",
        "ALTER TABLE biblioteca_busca ADD COLUMN usuario_id INTEGER",
        "ALTER TABLE biblioteca_busca ADD COLUMN link TEXT DEFAULT ''",
        "ALTER TABLE biblioteca_busca ADD COLUMN categoria TEXT DEFAULT ''",
        "ALTER TABLE biblioteca_busca ADD COLUMN artista TEXT DEFAULT ''",
        "ALTER TABLE biblioteca_busca ADD COLUMN codigo TEXT DEFAULT ''",
        "ALTER TABLE biblioteca_busca ADD COLUMN primeira_linha TEXT DEFAULT ''",
        "ALTER TABLE biblioteca_busca ADD COLUMN tom TEXT DEFAULT ''",
        "ALTER TABLE biblioteca_busca ADD COLUMN primeira_nota TEXT DEFAULT ''",
        "ALTER TABLE biblioteca_busca ADD COLUMN versao_vocal TEXT DEFAULT ''",
        "ALTER TABLE biblioteca_busca ADD COLUMN compasso TEXT DEFAULT ''",
        "ALTER TABLE biblioteca_busca ADD COLUMN bpm TEXT DEFAULT ''",
        "ALTER TABLE biblioteca_busca ADD COLUMN cifra TEXT DEFAULT ''",
        "ALTER TABLE biblioteca_busca ADD COLUMN versao_parecida TEXT DEFAULT ''",
        "ALTER TABLE biblioteca_busca ADD COLUMN tema_central TEXT DEFAULT ''",
    ]
    for sql in _alter_migrations:
        try:
            await client.execute(sql)
        except Exception:
            pass  # Coluna j existe  comportamento esperado

    # -------------------------------------------------------------------------
    # MIGRAO ESTRUTURAL: funcoes  adiciona ndices parciais UNIQUE(nome, usuario_id)
    # (Dbito Tcnico #2  resolve o hack do espao invisvel)
    #
    # SEGURO: NO dropa nem recria a tabela. O SQLite permite criar ndices
    # diretamente na tabela existente, preservando todos os dados e as
    # referncias em membro_funcoes.
    # -------------------------------------------------------------------------

    # ndices parciais (idempotentes via IF NOT EXISTS):
    #  Funes de usurio: UNIQUE(nome, usuario_id) para usuario_id IS NOT NULL
    try:
        await client.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS funcoes_nome_usuario
            ON funcoes(nome, usuario_id) WHERE usuario_id IS NOT NULL
        """)
    except Exception as e:
        # Pode falhar se houver nomes duplicados herdados do hack do espao.
        # Nesse caso, limpa os duplicados mantendo apenas o primeiro registro.
        print(f" ndice funcoes_nome_usuario: limpando duplicados antes de criar. ({e})")
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

    #  Funes globais: UNIQUE(nome) para usuario_id IS NULL
    try:
        await client.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS funcoes_nome_global
            ON funcoes(nome) WHERE usuario_id IS NULL
        """)
    except Exception as e:
        print(f" ndice funcoes_nome_global: limpando duplicados globais. ({e})")
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

    print(" ndices de funcoes verificados/criados com sucesso.")

    # -------------------------------------------------------------------------
    # REPARO DE INTEGRIDADE: remove entradas rfs de membro_funcoes
    # (membro_funcoes.funcao_id que no existem mais em funcoes)
    # Pode ocorrer se migrao anterior tiver sido destrutiva.
    # -------------------------------------------------------------------------
    orphans = await client.execute("""
        SELECT COUNT(*) FROM membro_funcoes mf
        WHERE NOT EXISTS (SELECT 1 FROM funcoes f WHERE f.id = mf.funcao_id)
    """)
    orphan_count = orphans.rows[0][0] if orphans.rows else 0
    if orphan_count > 0:
        print(f" Encontradas {orphan_count} referncias rfs em membro_funcoes. Removendo...")
        await client.execute("""
            DELETE FROM membro_funcoes
            WHERE NOT EXISTS (SELECT 1 FROM funcoes f WHERE f.id = funcao_id)
        """)

    # -------------------------------------------------------------------------
    # MIGRAO DE DADOS: CSV categoria  musica_categorias (one-time)
    # (Dbito Tcnico #3  popula a nova tabela associativa)
    # -------------------------------------------------------------------------
    mc_count = await client.execute("SELECT COUNT(*) FROM musica_categorias")
    bb_count = await client.execute(
        "SELECT COUNT(*) FROM biblioteca_busca WHERE categoria IS NOT NULL AND categoria != ''"
    )
    if mc_count.rows[0][0] == 0 and bb_count.rows[0][0] > 0:
        await _migrate_categorias_para_relacional()
