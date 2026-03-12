import os
import json
import asyncio
import libsql_client
from dotenv import load_dotenv

load_dotenv()

# --- CONFIGURAÇÕES ---
TURSO_URL = os.getenv("TURSO_DATABASE_URL")
TURSO_TOKEN = os.getenv("TURSO_AUTH_TOKEN")
MEU_ID_PESSOAL = 3  # ID da sua conta de Administradora

async def main():
    try:
        with open("analise_ia_teste.json", "r", encoding="utf-8") as f:
            musicas = json.load(f)
            print(f"📄 Arquivo 'analise_ia_teste.json' carregado com {len(musicas)} músicas.")
    except FileNotFoundError:
        print("⚠️ O arquivo 'analise_ia_teste.json' não foi encontrado.")
        return

    client = libsql_client.create_client(url=TURSO_URL, auth_token=TURSO_TOKEN)
    
    tabelas_antigas = ["agitadas1", "agitadas2", "lentas1", "lentas2", "ceia", "infantis", "natal", "junina", "casais", "pascoa", "missoes"]

    try:
        print("\n🧹 1. Removendo as tabelas antigas do banco de dados...")
        for tabela in tabelas_antigas:
            try:
                await client.execute(f"DROP TABLE IF EXISTS {tabela}")
            except Exception as e:
                print(f"Aviso ao apagar {tabela}: {e}")
                
        print("🧹 2. Limpando a tabela 'biblioteca_busca'...")
        await client.execute("DELETE FROM biblioteca_busca")
        print("✅ Banco de dados limpo e tabelas removidas!")

        # --- POPULAR A BASE DE DADOS ---
        print(f"\n🚀 Iniciando a injeção dupla (Global e Pessoal) para {len(musicas)} músicas...\n")
        
        for item in musicas:
            nome = item.get("nome", "").strip()
            artista = item.get("artista", "").strip()
            novas_tags = item.get("tags", "").strip()
            categoria_sugerida = item.get("categoria", "Sem Categoria")
            link_musica = item.get("link", "").strip()
            
            if not nome: continue

            # A) INJEÇÃO GLOBAL (Visitantes -> NULL)
            await client.execute(
                "INSERT INTO biblioteca_busca (nome_musica, artista, tags, categoria, link, usuario_id) VALUES (?, ?, ?, ?, ?, NULL)",
                [nome, artista, novas_tags, categoria_sugerida, link_musica]
            )
            
            # B) INJEÇÃO PESSOAL (Administradora -> ID 3)
            await client.execute(
                "INSERT INTO biblioteca_busca (nome_musica, artista, tags, categoria, link, usuario_id) VALUES (?, ?, ?, ?, ?, ?)",
                [nome, artista, novas_tags, categoria_sugerida, link_musica, MEU_ID_PESSOAL]
            )
            
            print(f"✨ INSERIDA: '{nome}' -> Categorias: {categoria_sugerida}")
            
        print("\n🎉 Processo de Migração e Povoamento concluído com sucesso absoluto!")
        
    except Exception as e:
        print(f"❌ Ocorreu um erro durante a execução: {e}")
    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(main())