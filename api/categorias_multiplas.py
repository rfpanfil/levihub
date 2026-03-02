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
        print("🔄 Configurando múltiplas categorias para todas as 201 músicas...\n")
        tabelas = ["agitadas1", "agitadas2", "lentas1", "lentas2", "ceia", "infantis"]

        # 1. Analisa as músicas gerais e junta as categorias
        res_bib = await client.execute("SELECT id, nome_musica FROM biblioteca_busca WHERE usuario_id = ?", [TARGET_USER_ID])

        for row in res_bib.rows:
            m_id = row[0]
            nome_bib = row[1].strip().lower()
            categorias_desta_musica = []
            
            for t in tabelas:
                res_tabela = await client.execute(f"SELECT conteudo FROM {t} WHERE usuario_id = ?", [TARGET_USER_ID])
                for row_t in res_tabela.rows:
                    nome_tab = row_t[0].strip().lower()
                    if nome_bib in nome_tab or nome_tab in nome_bib:
                        categorias_desta_musica.append(t)
                        break 
                        
            if categorias_desta_musica:
                string_categorias = ", ".join(categorias_desta_musica)
                await client.execute("UPDATE biblioteca_busca SET categoria = ? WHERE id = ?", [string_categorias, m_id])

        # 2. Aplica as órfãs com o seu mapeamento exato
        mapeamento_orfas = {
            "21 - Os Arrais": "lentas1, lentas2, ceia",
            "A Casa é sua - Megafone": "agitadas2, lentas1",
            "Águas Purificadoras - Diante do Trono": "lentas1, lentas2, ceia",
            "Castelo Forte": "ceia, agitadas2, lentas1",
            "Comunhão": "ceia, lentas1, lentas2",
            "Espírito enche a minha vida": "agitadas1, agitadas2",
            "Eu e Minha Casa": "lentas1, lentas2, ceia",
            "Eu tenho você": "lentas1, lentas2",
            "Esta paz que sinto em minh'alma": "agitadas2, lentas1",
            "Êxodo - Projeto Sola": "agitadas2, lentas1",
            "Fico Feliz (Bendito é o nome do Senhor)": "agitadas1, agitadas2",
            "Hey Pai": "agitadas1, agitadas2",
            "Sal dessa terra": "agitadas2, lentas1",
            "Santo, Santo, Santo (Holy, Holy, Holy)": "agitadas1, agitadas2",
            "Te agradeço (Eu te agradeço Deus, por se lebrar de mim...)": "agitadas1, agitadas2",
            "Tu és bom - Vineyard": "agitadas1, agitadas2",
            "Tu és Fiel, Senhor - Hino da Harpa 535": "lentas1, lentas2",
            "Tu És Santo - Vem Esta É a Hora - Te Louvarei Meu Bom Jesus": "agitadas1, agitadas2",
            "Vinho e Pão": "ceia, agitadas1, lentas2"
        }
        
        for nome_musica, cats in mapeamento_orfas.items():
            await client.execute(
                "UPDATE biblioteca_busca SET categoria = ? WHERE nome_musica = ? AND usuario_id = ?",
                [cats, nome_musica, TARGET_USER_ID]
            )

        print("✅ Sucesso! Agora as suas músicas possuem múltiplas categorias divididas por vírgula!")

    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(main())