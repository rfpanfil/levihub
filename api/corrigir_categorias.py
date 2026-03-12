import os
import asyncio
import libsql_client
from dotenv import load_dotenv

# Carrega as variáveis do arquivo .env
load_dotenv()

TURSO_URL = os.getenv("TURSO_DATABASE_URL")
TURSO_TOKEN = os.getenv("TURSO_AUTH_TOKEN")

async def main():
    if not TURSO_URL or not TURSO_TOKEN:
        print("⚠️ Erro: As credenciais do Turso não foram encontradas no arquivo .env!")
        return

    client = libsql_client.create_client(url=TURSO_URL, auth_token=TURSO_TOKEN)
    
    # Lista com o nome da música e a categoria correta que você quer inserir
    musicas_para_corrigir = [
        {"nome": "Eu tenho um chamado", "categoria": "agitadas2, lentas1, missoes"},
        {"nome": "Noite Feliz", "categoria": "natal"}
    ]

    try:
        print("\n🚀 Iniciando a correção das categorias...\n")
        
        for musica in musicas_para_corrigir:
            # Executa o UPDATE no banco de dados
            res = await client.execute(
                "UPDATE biblioteca_busca SET categoria = ? WHERE nome_musica = ?",
                [musica["categoria"], musica["nome"]]
            )
            
            # res.rows_affected deve retornar 2 (1 da global e 1 da sua conta pessoal)
            print(f"✅ Música '{musica['nome']}' atualizada para: [{musica['categoria']}] ({res.rows_affected} registros afetados).")

        print("\n🎉 Correção finalizada com sucesso!")
        
    except Exception as e:
        print(f"❌ Ocorreu um erro durante a atualização: {e}")
    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(main())