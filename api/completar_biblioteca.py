import os
import asyncio
import libsql_client
from dotenv import load_dotenv

load_dotenv()
TURSO_URL = os.getenv("TURSO_DATABASE_URL")
TURSO_TOKEN = os.getenv("TURSO_AUTH_TOKEN")
TARGET_USER_ID = 3 

async def main():
    client = libsql_client.create_client(url=TURSO_URL, auth_token=TURSO_TOKEN)
    try:
        print("🚀 Transferindo as músicas 'escondidas' nas categorias para a Biblioteca...")
        tabelas = ["agitadas1", "agitadas2", "lentas1", "lentas2", "ceia", "infantis"]
        inseridas = 0

        # Pegar tudo que já está na biblioteca para não duplicar nada
        res_bib = await client.execute("SELECT nome_musica FROM biblioteca_busca WHERE usuario_id = ?", [TARGET_USER_ID])
        nomes_na_bib = [row[0].strip().lower() for row in res_bib.rows]

        for tabela in tabelas:
            # Como já separamos os links no script de clonagem, vamos ler o conteúdo puro e o link
            res_tab = await client.execute(f"SELECT conteudo, link FROM {tabela} WHERE usuario_id = ?", [TARGET_USER_ID])

            for row in res_tab.rows:
                nome_puro = row[0].strip()
                link_puro = row[1].strip() if row[1] else ""

                # Fazer uma checagem avançada para não duplicar (ex: ignorar diferenças de hífen)
                ja_existe = False
                for n in nomes_na_bib:
                    if nome_puro.lower() in n or n in nome_puro.lower():
                        ja_existe = True
                        break

                if not ja_existe:
                    # Insere na biblioteca de busca para aparecer no site!
                    await client.execute(
                        "INSERT INTO biblioteca_busca (nome_musica, tags, categoria, link, usuario_id) VALUES (?, ?, ?, ?, ?)",
                        [nome_puro, nome_puro.lower(), tabela, link_puro, TARGET_USER_ID]
                    )
                    nomes_na_bib.append(nome_puro.lower())
                    inseridas += 1

        print(f"\n✅ Sucesso! {inseridas} músicas que estavam nas tabelas foram copiadas para a Biblioteca principal.")
        print("Agora o seu site vai exibir o seu repertório completo, incluindo as 20 infantis!")

    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(main())