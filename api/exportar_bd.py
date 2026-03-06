import os
import asyncio
import libsql_client
from dotenv import load_dotenv

load_dotenv()

TURSO_URL = os.getenv("TURSO_DATABASE_URL")
TURSO_TOKEN = os.getenv("TURSO_AUTH_TOKEN")

async def exportar_banco():
    client = libsql_client.create_client(url=TURSO_URL, auth_token=TURSO_TOKEN)
    try:
        # Busca todas as músicas globais ordenadas por nome
        res = await client.execute("SELECT id, nome_musica, tags, categoria, link, usuario_id FROM biblioteca_busca WHERE usuario_id IS NULL ORDER BY nome_musica")
        
        with open("DUMP_BIBLIOTECA.txt", "w", encoding="utf-8") as f:
            f.write("=== EXPORTAÇÃO DO BANCO DE DADOS: BIBLIOTECA_BUSCA ===\n\n")
            
            for row in res.rows:
                m_id, nome, tags, cat, link, uid = row
                
                # Identifica se é do sistema geral ou de um usuário específico
                tipo = "🌍 GLOBAL" if uid is None else f"👤 PESSOAL (ID: {uid})"
                link_str = link if link else "Nenhum link cadastrado"
                cat_str = cat if cat else "Sem categoria"
                tags_str = tags if tags else "Sem tags"
                
                f.write(f"Música: {nome}\n")
                f.write(f"Origem: {tipo} | ID: {m_id}\n")
                f.write(f"Categorias: {cat_str}\n")
                f.write(f"Tags: {tags_str}\n")
                f.write(f"Link: {link_str}\n")
                f.write("-" * 50 + "\n")
                
        print("✅ Exportação concluída! O arquivo 'DUMP_BIBLIOTECA.txt' foi gerado com sucesso.")
    except Exception as e:
        print(f"Erro ao exportar: {e}")
    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(exportar_banco())