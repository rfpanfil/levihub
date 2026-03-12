import os
import asyncio
import libsql_client
from dotenv import load_dotenv

# Carrega as variáveis do arquivo .env (TURSO_DATABASE_URL e TURSO_AUTH_TOKEN)
load_dotenv()

TURSO_URL = os.getenv("TURSO_DATABASE_URL")
TURSO_TOKEN = os.getenv("TURSO_AUTH_TOKEN")

async def main():
    if not TURSO_URL or not TURSO_TOKEN:
        print("⚠️ Erro: As credenciais do Turso não foram encontradas no arquivo .env!")
        return

    client = libsql_client.create_client(url=TURSO_URL, auth_token=TURSO_TOKEN)
    
    try:
        print("\n🕵️ --- INICIANDO RAIO-X DO BANCO DE DADOS ---")
        
        # 1. Pede ao banco de dados a lista de TODAS as tabelas existentes
        # (Ignorando tabelas internas do SQLite que começam com sqlite_)
        res_tabelas = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        tabelas = [row[0] for row in res_tabelas.rows]
        
        print(f"✅ Foram encontradas {len(tabelas)} tabelas no seu banco.\n")
        print("="*50)
        
        # 2. Faz o loop por cada tabela encontrada
        for tabela in tabelas:
            try:
                # Vê quais colunas existem nesta tabela
                info = await client.execute(f"PRAGMA table_info({tabela})")
                colunas = [row[1] for row in info.rows]
                
                # Conta quantos registros (músicas/usuários) existem nela
                res_count = await client.execute(f"SELECT COUNT(*) FROM {tabela}")
                qtd = res_count.rows[0][0]
                
                # Exibe o resultado formatado
                print(f"📁 TABELA: {tabela}")
                print(f"   📊 Total de Registros: {qtd}")
                print(f"   🏷️  Colunas: {', '.join(colunas)}")
                print("-" * 50)
                
            except Exception as e:
                print(f"   ❌ Erro ao analisar a tabela '{tabela}': {e}")
                
    finally:
        await client.close()
        print("🔍 Análise concluída e conexão encerrada.")

if __name__ == "__main__":
    asyncio.run(main())