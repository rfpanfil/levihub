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
    # 1. Carregar o arquivo JSON de teste
    try:
        with open("analise_ia_teste.json", "r", encoding="utf-8") as f:
            musicas = json.load(f)
            print(f"📄 Arquivo 'analise_ia_teste.json' carregado com {len(musicas)} músicas.")
    except FileNotFoundError:
        print("⚠️ O arquivo 'analise_ia_teste.json' não foi encontrado. Salve-o na mesma pasta do script.")
        return

    client = libsql_client.create_client(url=TURSO_URL, auth_token=TURSO_TOKEN)
    
    # As tabelas da roleta dos visitantes
    tabelas_globais = ["agitadas1", "agitadas2", "lentas1", "lentas2", "ceia", "infantis"]

    try:
        # --- 2. LIMPAR A BASE DE DADOS ---
        print("\n🧹 Limpando o banco de dados (Reset de Fábrica)...")
        
        await client.execute("DELETE FROM biblioteca_busca")
        for tabela in tabelas_globais:
            await client.execute(f"DELETE FROM {tabela}")
            
        print("✅ Banco de dados limpo com sucesso!")

        # --- 3. POPULAR A BASE DE DADOS ---
        print(f"\n🚀 Iniciando a injeção dupla (Global e Pessoal) para {len(musicas)} músicas...\n")
        
        for item in musicas:
            nome = item.get("nome", "").strip()
            artista = item.get("artista", "").strip()
            novas_tags = item.get("tags", "").strip()
            categoria_sugerida = item.get("categoria", "Sem Categoria")
            link_musica = item.get("link", "").strip()
            
            if not nome: continue

            # A) INJEÇÃO GLOBAL (Visitantes)
            await client.execute(
                "INSERT INTO biblioteca_busca (nome_musica, artista, tags, categoria, link, usuario_id) VALUES (?, ?, ?, ?, ?, NULL)",
                [nome, artista, novas_tags, categoria_sugerida, link_musica]
            )
            
            # Divide as categorias separadas por vírgula para a Roleta Global
            categorias_separadas = [c.strip().lower() for c in categoria_sugerida.split(',')]
            for cat in categorias_separadas:
                if cat in tabelas_globais:
                    await client.execute(
                        f"INSERT INTO {cat} (conteudo, artista, link, usuario_id) VALUES (?, ?, ?, NULL)",
                        [nome, artista, link_musica]
                    )
            
            # B) INJEÇÃO PESSOAL (Administradora)
            await client.execute(
                "INSERT INTO biblioteca_busca (nome_musica, artista, tags, categoria, link, usuario_id) VALUES (?, ?, ?, ?, ?, ?)",
                [nome, artista, novas_tags, categoria_sugerida, link_musica, MEU_ID_PESSOAL]
            )
            
            print(f"✨ INSERIDA: '{nome}' ({artista if artista else 'Sem Artista'}) -> Categorias: {categoria_sugerida}")
            
        print("\n🎉 Processo de Limpeza e Povoamento concluído com sucesso absoluto!")
        
    except Exception as e:
        print(f"❌ Ocorreu um erro durante a execução: {e}")
    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(main())