import os
import json
import asyncio
import libsql_client
from dotenv import load_dotenv

load_dotenv()

# --- CONFIGURAÇÕES ---
TURSO_URL = os.getenv("TURSO_DATABASE_URL")
TURSO_TOKEN = os.getenv("TURSO_AUTH_TOKEN")
MEU_ID_PESSOAL = 3  # ID da sua conta de Administradora (Mude se for outro número)

def juntar_tags(tags_antigas, tags_novas):
    """Funde as tags do banco com as novas da IA, removendo duplicatas."""
    lista_antiga = [t.strip().lower() for t in tags_antigas.split(',') if t.strip()]
    lista_nova = [t.strip().lower() for t in tags_novas.split(',') if t.strip()]
    todas_as_tags = set(lista_antiga + lista_nova)
    return ", ".join(sorted(list(todas_as_tags)))

async def main():
    try:
        with open("analise_ia.json", "r", encoding="utf-8") as f:
            musicas_analisadas = json.load(f)
    except FileNotFoundError:
        print("⚠️ O arquivo 'analise_ia.json' não foi encontrado.")
        return

    client = libsql_client.create_client(url=TURSO_URL, auth_token=TURSO_TOKEN)
    
    # As tabelas clássicas que alimentam a roleta dos visitantes
    tabelas_globais = ["agitadas1", "agitadas2", "lentas1", "lentas2", "ceia", "infantis"]

    try:
        print(f"🚀 Iniciando a injeção dupla para {len(musicas_analisadas)} músicas...")
        
        for item in musicas_analisadas:
            nome = item.get("nome", "").strip()
            artista = item.get("artista", "").strip() # <-- LÊ O NOME DO ARTISTA
            novas_tags = item.get("tags", "").strip()
            categoria_sugerida = item.get("categoria", "Sem Categoria")
            link_musica = item.get("link", "").strip() 
            
            if not nome: continue

            # --- LAÇO DE INJEÇÃO DUPLA (Primeiro Global=None, depois Pessoal=ID) ---
            for user_id in [None, MEU_ID_PESSOAL]:
                tipo_banco = "🌍 GLOBAL" if user_id is None else "👤 PESSOAL"

                # 1. Procura a música no banco específico
                if user_id is None:
                    res = await client.execute("SELECT id, tags FROM biblioteca_busca WHERE LOWER(nome_musica) = LOWER(?) AND usuario_id IS NULL", [nome])
                else:
                    res = await client.execute("SELECT id, tags FROM biblioteca_busca WHERE LOWER(nome_musica) = LOWER(?) AND usuario_id = ?", [nome, user_id])

                if res.rows:
                    # 2. MÚSICA EXISTE: Mesclar as tags
                    id_musica = res.rows[0][0]
                    tags_banco = res.rows[0][1] or ""
                    tags_atualizadas = juntar_tags(tags_banco, novas_tags)
                    
                    await client.execute(
                        "UPDATE biblioteca_busca SET tags = ? WHERE id = ?",
                        [tags_atualizadas, id_musica]
                    )
                    print(f"🔄 ATUALIZADA no {tipo_banco}: '{nome}'")
                else:
                    # 3. MÚSICA NÃO EXISTE: Criar do zero
                    if user_id is None:
                        # Insere na busca Global
                        await client.execute(
                            "INSERT INTO biblioteca_busca (nome_musica, artista, tags, categoria, link, usuario_id) VALUES (?, ?, ?, ?, ?, NULL)",
                            [nome, artista, novas_tags, categoria_sugerida, link_musica]
                        )
                        # O json pode ter várias categorias separadas por vírgula. Vamos colocar em todas as roletas globais válidas!
                        categorias_separadas = [c.strip().lower() for c in categoria_sugerida.split(',')]
                        for cat in categorias_separadas:
                            if cat in tabelas_globais:
                                await client.execute(
                                    f"INSERT INTO {cat} (conteudo, link, usuario_id) VALUES (?, ?, NULL)",
                                    [nome, link_musica]
                                )
                    else:
                        # Insere na busca/roleta Pessoal
                        await client.execute(
                            "INSERT INTO biblioteca_busca (nome_musica, artista, tags, categoria, link, usuario_id) VALUES (?, ?, ?, ?, ?, ?)",
                            [nome, artista, novas_tags, categoria_sugerida, link_musica, user_id]
                        )
                    print(f"✨ CRIADA no {tipo_banco}: '{nome}'")
                    
        print("\n🎉 PROCESSO CONCLUÍDO COM SUCESSO EM AMBOS OS REPERTÓRIOS!")
    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(main())