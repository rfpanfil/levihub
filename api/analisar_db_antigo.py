import asyncio
import libsql_client

# As suas credenciais do Banco Antigo
OLD_URL = "https://levi-roboto-db-rfpanfil.aws-us-east-2.turso.io"
OLD_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzI0NjU5MjEsImlkIjoiMzZkMGNlYmItZDIwMS00NWU1LWI0ZTgtMDk5MmJhNWUzZTVlIiwicmlkIjoiMzZjYTljZjQtNmE0Ny00MDc4LTk5NWItYzY5YWJiY2FmMjA3In0.dBMjKt1w3sfnoAFxz5pLttmExixErxtqGR9dwNdRD6mzanWfHnpCChDBWi6AjUs4fELZ1Wm-4Wr1haczN63ZBQ"

async def main():
    client = libsql_client.create_client(url=OLD_URL, auth_token=OLD_TOKEN)
    try:
        print("🕵️ --- ANALISANDO O BANCO DE DADOS ANTIGO (levi-roboto-db) ---")
        tabelas = ["agitadas1", "agitadas2", "lentas1", "lentas2", "ceia", "infantis", "biblioteca_busca"]
        
        for tabela in tabelas:
            try:
                # Vê quais colunas existiam
                info = await client.execute(f"PRAGMA table_info({tabela})")
                colunas = [row[1] for row in info.rows]
                
                # Conta as músicas
                res = await client.execute(f"SELECT COUNT(*) FROM {tabela}")
                qtd = res.rows[0][0]
                
                print(f"\n📁 Tabela: {tabela}")
                print(f"   - Músicas: {qtd}")
                print(f"   - Colunas: {colunas}")
            except Exception:
                print(f"   ❌ A tabela '{tabela}' não existe neste banco.")
    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(main())