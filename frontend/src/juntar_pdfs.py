import os
from PyPDF2 import PdfReader

# Nome do arquivo final
ARQUIVO_SAIDA = "BIG_TEXTO_LETRAS.txt"

def extrair_texto_pdf(caminho_pdf):
    texto_completo = ""
    try:
        leitor = PdfReader(caminho_pdf)
        for pagina in leitor.pages:
            texto_pagina = pagina.extract_text()
            if texto_pagina:
                texto_completo += texto_pagina + "\n"
    except Exception as e:
        print(f"⚠️ Erro ao ler {caminho_pdf}: {e}")
        return None
    return texto_completo

def gerar_big_txt():
    # Pega a pasta onde o script está
    pasta_raiz = os.getcwd()
    print(f"📂 Varrendo PDFs em: {pasta_raiz}")
    
    arquivos_processados = 0
    
    with open(ARQUIVO_SAIDA, "w", encoding="utf-8") as saida:
        saida.write("=== ARQUIVO UNIFICADO DE LETRAS ===\n\n")
        
        for raiz, subpastas, arquivos in os.walk(pasta_raiz):
            for arquivo in arquivos:
                if arquivo.lower().endswith(".pdf"):
                    caminho_completo = os.path.join(raiz, arquivo)
                    print(f"📄 Processando: {arquivo}...")
                    
                    texto = extrair_texto_pdf(caminho_completo)
                    
                    if texto and len(texto.strip()) > 10: # Ignora PDFs vazios
                        # CRIA O SEPARADOR PARA A IA LER DEPOIS
                        saida.write("\n" + "="*50 + "\n")
                        saida.write(f"ARQUIVO: {arquivo}\n")
                        saida.write("="*50 + "\n")
                        saida.write(texto)
                        saida.write("\n\n")
                        arquivos_processados += 1

    print("\n" + "="*40)
    print(f"✅ CONCLUÍDO! {arquivos_processados} PDFs foram unidos.")
    print(f"📂 Arquivo gerado: {ARQUIVO_SAIDA}")
    print("="*40)

if __name__ == "__main__":
    gerar_big_txt()