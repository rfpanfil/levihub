import os
import asyncio
import libsql_client
from dotenv import load_dotenv

load_dotenv()

# --- CREDENCIAIS DO BANCO ANTIGO (A FONTE DA VERDADE) ---
OLD_URL = "https://levi-roboto-db-rfpanfil.aws-us-east-2.turso.io"
OLD_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzI0NjU5MjEsImlkIjoiMzZkMGNlYmItZDIwMS00NWU1LWI0ZTgtMDk5MmJhNWUzZTVlIiwicmlkIjoiMzZjYTljZjQtNmE0Ny00MDc4LTk5NWItYzY5YWJiY2FmMjA3In0.dBMjKt1w3sfnoAFxz5pLttmExixErxtqGR9dwNdRD6mzanWfHnpCChDBWi6AjUs4fELZ1Wm-4Wr1haczN63ZBQ"

# --- CREDENCIAIS DO BANCO NOVO (ONDE VAMOS GRAVAR) ---
NEW_URL = os.getenv("TURSO_DATABASE_URL")
NEW_TOKEN = os.getenv("TURSO_AUTH_TOKEN")
TARGET_USER_ID = 3 

async def main():
    client_old = libsql_client.create_client(url=OLD_URL, auth_token=OLD_TOKEN)
    client_new = libsql_client.create_client(url=NEW_URL, auth_token=NEW_TOKEN)

    try:
        print("🧹 1. Limpando a sua conta no banco novo para não haver misturas...")
        tabelas = ["agitadas1", "agitadas2", "lentas1", "lentas2", "ceia", "infantis"]
        
        for t in tabelas:
            await client_new.execute(f"DELETE FROM {t} WHERE usuario_id = ?", [TARGET_USER_ID])
        await client_new.execute("DELETE FROM biblioteca_busca WHERE usuario_id = ?", [TARGET_USER_ID])

        print("🔄 2. Iniciando a clonagem EXATA do banco antigo...\n")

        # --- CLONAR AS TABELAS ESPECÍFICAS ---
        for tabela in tabelas:
            res_old = await client_old.execute(f"SELECT conteudo FROM {tabela}")
            print(f"📥 Restaurando a tabela '{tabela}' ({len(res_old.rows)} músicas)...")
            
            for row in res_old.rows:
                conteudo_full = row[0]
                
                # Separa nome e link mantendo exatamente a mesma música e quantidade
                if "http" in conteudo_full:
                    partes = conteudo_full.split("http", 1)
                    nome = partes[0].strip(" :")
                    link = "http" + partes[1].strip()
                else:
                    nome = conteudo_full.strip(" :")
                    link = ""
                
                await client_new.execute(
                    f"INSERT INTO {tabela} (conteudo, link, usuario_id) VALUES (?, ?, ?)",
                    [nome, link, TARGET_USER_ID]
                )

        # --- CLONAR A BIBLIOTECA_BUSCA ---
        res_old_bib = await client_old.execute("SELECT nome_musica, tags FROM biblioteca_busca")
        print(f"\n📥 Restaurando a tabela 'biblioteca_busca' ({len(res_old_bib.rows)} músicas)...")

        for row in res_old_bib.rows:
            nome_full = row[0]
            tags = row[1]
            
            if "http" in nome_full:
                partes = nome_full.split("http", 1)
                nome = partes[0].strip(" :")
                link = "http" + partes[1].strip()
            else:
                nome = nome_full.strip(" :")
                link = ""

            # Descobre em qual tabela antiga essa música estava para dar a "categoria" certa no React
            categoria = "Sem Categoria"
            for t in tabelas:
                check = await client_old.execute(f"SELECT id FROM {t} WHERE conteudo = ?", [nome_full])
                if check.rows:
                    categoria = t
                    break

            await client_new.execute(
                "INSERT INTO biblioteca_busca (nome_musica, tags, categoria, link, usuario_id) VALUES (?, ?, ?, ?, ?)",
                [nome, tags, categoria, link, TARGET_USER_ID]
            )

        print("\n✅ CLONAGEM CONCLUÍDA COM SUCESSO ABSOLUTO!")
        print("Pode testar o script de verificação de quantidades novamente. Os números serão rigorosamente idênticos!")

    except Exception as e:
        print(f"❌ Erro: {e}")
    finally:
        await client_old.close()
        await client_new.close()

if __name__ == "__main__":
    asyncio.run(main())