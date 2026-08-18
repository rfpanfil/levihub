<div align="center">
  <h1>🎸 LeviHub</h1>
  <p><strong>Sistema Inteligente de Gestão de Ministérios de Louvor</strong></p>
  
  [![Deploy on Vercel](https://img.shields.io/badge/Deploy-Vercel-black?style=for-the-badge&logo=vercel)](https://levihub.vercel.app)
  [![Python FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
  [![React Vite](https://img.shields.io/badge/Frontend-React_Vite-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
</div>

<br/>

> **🔗 Acesse a aplicação ao vivo:** [https://levihub.vercel.app](https://levihub.vercel.app)  
> *(Para avaliar a aplicação rapidamente, clique em **"Entrar como Visitante"** na tela de login)*

O **LeviHub** é uma aplicação Full-Stack desenvolvida para resolver as complexidades da organização de equipes de música em igrejas. O projeto automatiza a geração de escalas de voluntários e oferece ferramentas avançadas para músicos, incluindo um transposto nativo de cifras em arquivos Microsoft Word (`.docx`).

---

## 🚀 Principais Desafios Técnicos Resolvidos

Este projeto não é apenas um CRUD. Ele soluciona problemas lógicos e de manipulação de arquivos não triviais:

### 1. Algoritmo Inteligente de Geração de Escalas
Gerar escalas não é apenas distribuir pessoas; é resolver um problema de satisfação de restrições (Constraint Satisfaction Problem - CSP).
- **Cruzamento de Dados:** O sistema cruza as funções de cada membro, suas disponibilidades de dias no mês, e regras customizadas (ex: limite de vezes que uma pessoa pode tocar por mês).
- **Evitando Colisões:** O algoritmo garante que funções essenciais sejam preenchidas de forma equitativa, distribuindo as oportunidades e evitando sobrecarga de membros específicos.

### 2. Transposição Nativa de Arquivos DOCX e PDF
Diferente de geradores de cifras convencionais (que usam texto puro), as igrejas geralmente possuem vastos repositórios de cifras formatadas em `.docx` com ilustrações, formatações de colunas e tags visuais.
- **Engenharia Reversa de XML:** O backend (Python) abre o arquivo `.docx`, descompacta sua estrutura XML nativa e identifica via Expressões Regulares (`RegEx`) quais nós de texto (`<w:t>`) contêm acordes musicais e quais contêm letras da música.
- **Preservação de Layout:** O motor transpõe os tons musicais mantendo 100% da estrutura visual original intacta — protegendo formas (`<w:drawing>`), tabelas, fontes e alinhamentos de sofrerem corrupção.

### 3. Refatoração e Gerenciamento de Estado (Context API)
Com o crescimento das funcionalidades (Drag & Drop, Modais, Geração Automática), as propriedades estavam sofrendo um forte *Prop Drilling* no React. O projeto foi refatorado utilizando **Context API**, separando responsabilidades, melhorando a performance de re-renderização e consolidando as chamadas assíncronas em provedores unificados.

---

## 🛠️ Stack Tecnológico

### Frontend
- **Framework:** React 19 + Vite
- **Estilização:** Vanilla CSS (Mobile-First, Design Tokens, Glassmorphism UI)
- **Gestão de Estado e Fetching:** Context API, React Query
- **Utilitários:** Mammoth.js (Parse de documentos), HTML2Canvas (Geração de imagens das escalas)
- **Deploy:** Vercel

### Backend
- **Framework:** Python + FastAPI (Assíncrono e de alta performance)
- **Banco de Dados:** SQLite (com suporte ao Turso para ambientes Serverless/Edge)
- **Manipulação DOCX:** `python-docx`, XPath para navegação avançada em XML
- **Autenticação:** JWT (JSON Web Tokens), Hasheamento via Passlib, Cookies HttpOnly

### DevOps & Arquitetura
- Configuração Docker completa (`docker-compose`) englobando API, Frontend e persistência de dados.
- Configuração de CI/CD via GitHub Actions e integrações de segurança automatizadas (Snyk, Dependabot).

---

## ⚙️ Como Executar Localmente

### Pré-requisitos
- Node.js v18+
- Python 3.10+
- Docker e Docker Compose (Opcional, mas recomendado)

### Rodando com Docker (Forma mais fácil)

1. Clone o repositório:
```bash
git clone https://github.com/rfpanfil/levihub.git
cd levihub
```

2. Suba os containers:
```bash
docker-compose up --build
```
> O frontend estará rodando em `http://localhost:5173` e a API em `http://localhost:8000`.

### Rodando Manualmente

**Backend (Terminal 1):**
```bash
cd api
python -m venv venv
source venv/bin/activate  # (No Windows: venv\Scripts\activate)
pip install -r ../requirements.txt
uvicorn main:app --reload
```

**Frontend (Terminal 2):**
```bash
cd frontend
npm install
npm run dev
```

---

<div align="center">
  <i>Desenvolvido com dedicação e propósito. Código aberto para estudo e avaliação técnica.</i><br/>
  <b>Desenvolvido por <a href="https://github.com/rfpanfil">Rafael Panfil</a></b>
</div>
