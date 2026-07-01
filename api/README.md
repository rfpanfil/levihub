# 🎸 LeviHub API - Arquitetura

Bem-vindo(a) ao backend do **LeviHub**!

Este projeto foi refatorado recentemente, saindo de um padrão Monolítico (onde todo o código ficava em um único arquivo gigante) para uma **Arquitetura Modular Moderna** baseada no padrão do FastAPI.

## 🏗️ Estrutura Atual (Onde você deve trabalhar)

- `main.py`: É o ponto de entrada real da aplicação. Aqui o servidor FastAPI é instanciado, os middlewares (CORS) são configurados e os roteadores são incluídos.
- `security.py`: Centraliza a lógica de autenticação, JWT e hashing de senhas.
- `database.py`: Gerencia a conexão Singleton com o banco de dados Turso e executa as migrações automáticas.
- `routers/`: Esta pasta é o coração atual do sistema. Cada funcionalidade possui seu próprio arquivo isolado:
  - `auth.py`: Login, cadastro, verificação de e-mail.
  - `equipe.py`: Gerenciamento de membros.
  - `musicas.py`: Gerenciamento do repertório.
  - ...etc.

## 🗑️ Sobre os Arquivos de Backup

Você encontrará arquivos como `api_backup.py` e `api - Backup.py` nesta raiz.
**Eles são arquivos mortos/obsoletos.**
Foram mantidos pela equipe apenas por precaução histórica (para consulta de lógicas muito antigas antes da modularização).
**NUNCA adicione lógicas novas ou dependa destes arquivos para a API funcionar.**

Para rodar a API em desenvolvimento local, use:
```bash
uvicorn api.main:app --reload
```
