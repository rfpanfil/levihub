# 🛡️ Relatório de Auditoria Profunda - LeviHub

Este relatório apresenta uma análise crítica e rigorosa da base de código atual do LeviHub (Frontend React/Vite + Backend FastAPI/Turso). Os problemas foram mapeados em 4 pilares principais e classificados por nível de prioridade.

---

## 1. 🛡️ Segurança (Cybersecurity)

### 🔴 PRIORIDADE CRÍTICA: Armazenamento Inseguro de JWT
* **O Problema:** Atualmente, o frontend armazena o token JWT de autenticação no `localStorage` (visto em `Login.jsx`, `GeradorEscala.jsx`, `LeviRoboto.jsx`).
* **O Risco:** Qualquer script malicioso injetado na página (ataque XSS via dependência do NPM comprometida ou input mal tratado) pode ler o `localStorage` e roubar o token, sequestrando a sessão do utilizador.
* **A Solução:** Migrar a autenticação para **Cookies HttpOnly e Secure**. O backend deve retornar o token no cabeçalho `Set-Cookie` e o frontend usará `credentials: 'include'` nas requisições fetch.

### 🟠 PRIORIDADE ALTA: Ausência de Rate Limiting
* **O Problema:** O backend (`main.py` e rotas de `auth.py`) não possui limite de requisições por IP ou por utilizador.
* **O Risco:** Endpoints como `/auth/login` ou a criação de utilizadores estão expostos a ataques de força bruta (brute force) e Credential Stuffing, além de vulnerabilidade a ataques de negação de serviço (DoS) que podem esgotar as chamadas gratuitas do banco Turso.
* **A Solução:** Implementar a biblioteca `slowapi` no FastAPI para limitar o número de requisições por IP (ex: 5 tentativas de login por minuto).

### 🟡 PRIORIDADE MÉDIA: Vazamento de Exceções (Information Disclosure)
* **O Problema:** Várias rotas (ex: `escalas_config.py` e `roboto_config.py`) usam um bloco genérico `except Exception as e: return {"error": str(e)}`.
* **O Risco:** Em caso de falha de banco de dados, o `str(e)` pode retornar queries SQL internas, nomes de tabelas ou lógicas de infraestrutura diretamente para o cliente, facilitando a exploração por atacantes.
* **A Solução:** Logar o erro internamente com `logger.error(e)` e retornar uma mensagem genérica e segura para o cliente (ex: `"Erro interno ao processar a requisição"`), usando o `HTTPException` padrão do FastAPI.

### 🟡 PRIORIDADE MÉDIA: Validação de Inputs Fraca no Pydantic
* **O Problema:** Os schemas em `models.py` (ex: `MembroRequest`, `NovaMusicaRequest`) definem os tipos (str, int), mas não impõem limites de tamanho (`max_length`) ou validações por Regex (ex: formato de telefone).
* **O Risco:** Atacantes podem enviar payloads gigantescos para consumir memória ou strings malformadas que quebram a lógica de exibição do frontend. Confiar apenas na validação do frontend é uma falha de design de segurança.
* **A Solução:** Usar o `Field` do Pydantic para impor validações rigorosas: `nome: str = Field(..., min_length=2, max_length=100)`.

---

## 2. ⚡ Otimização e Performance

### 🟠 PRIORIDADE ALTA: Cálculos Síncronos e Bloqueio de Thread (Frontend)
* **O Problema:** A função `gerarEscalas` roda na main thread do navegador. O rollback do Web Worker corrigiu os bugs de serialização, mas o problema arquitetural voltou.
* **O Risco:** Se a igreja crescer (equipes grandes com muitas regras e indisponibilidades), o algoritmo combinatório travará a aba do navegador ("freeze") do utilizador durante o cálculo.
* **A Solução:** Mover o cálculo complexo (`gerarEscalas`) para o Backend (FastAPI). Python lidará com o processamento mais rapidamente e a API apenas devolverá a matriz pronta, mantendo a UI do React sempre leve e fluida.

### 🟡 PRIORIDADE MÉDIA: Gargalos de Renderização (React)
* **O Problema:** O `GeradorEscala.jsx` passa funções locais (criadas a cada render) e objetos pesados para seus "Dumb Components" sem o uso de `useCallback` ou `useMemo`.
* **O Risco:** Sempre que um estado pequeno muda (ex: utilizador digita num input), toda a árvore de componentes visuais (Tabela, Painel, Resultado) é re-renderizada desnecessariamente, causando "lags" visuais em telemóveis antigos.
* **A Solução:** Envolver callbacks pesados em `useCallback` e memoizar listas mapeadas com `useMemo`. Garantir que os Dumb Components usem `React.memo()`.

### 🔵 PRIORIDADE BAIXA: Ausência de Caching e Sincronização Automática
* **O Problema:** O uso extensivo de `fetch` puro espalhado em `useEffect` cria um código verboso e propenso a race conditions.
* **O Risco:** Maior tempo de manutenção e experiência menos fluida se a internet oscilar.
* **A Solução:** Adotar o **React Query (TanStack Query)** no frontend. Ele gerencia cache, tentativas de reconexão (retries), estados de "loading" e elimina a necessidade de dezenas de `useStates` locais.

---

## 3. 📱 Usabilidade e Responsividade (UI/UX)

### 🟠 PRIORIDADE ALTA: Quebra de Layout na Matriz de Escala em Mobile
* **O Problema:** O componente `ResultadoEscala` (matriz de cruzamento de dias vs. membros) funciona bem em desktop, mas é inerentemente hostil para telas pequenas.
* **O Risco:** Em telemóveis, a tabela ficará cortada ou forçará um scroll horizontal extremo, tornando o recurso de drag-and-drop (arrastar membros) praticamente inusável.
* **A Solução:** Implementar um layout responsivo condicional: em desktop mantém a matriz de tabela cruzada; em mobile (CSS `@media query`), transformar numa visualização de lista colapsável por culto/dia, substituindo o drag-and-drop por um botão nativo de "Trocar/Editar".

### 🟡 PRIORIDADE MÉDIA: Resiliência de Rede (Offline/Timeout)
* **O Problema:** As requisições de salvar contexto e persistência (fire-and-forget) falham silenciosamente no `console.warn` se o utilizador perder a conexão.
* **O Risco:** O utilizador acha que salvou a configuração, mas ao recarregar a página, os dados desapareceram sem aviso prévio.
* **A Solução:** Implementar uma fila de sincronização (Sync Queue) simples ou um Toast Alert de aviso: *"Você está offline. As alterações serão salvas localmente."*

---

## 4. 🏗️ Arquitetura e Dívida Técnica

### 🟠 PRIORIDADE ALTA: Prop Drilling Extremo
* **O Problema:** No `GeradorEscala.jsx`, componentes como `PainelRegras` recebem quase 10 props diferentes (`regras`, `equipa`, `catalogoVagas`, funções de manipulação, etc.).
* **O Risco:** O código fica difícil de testar, estender e manter. Qualquer nova funcionalidade exige alterar a assinatura de múltiplos ficheiros interligados.
* **A Solução:** Introduzir a **Context API** do React (ex: `EscalaContext`). O Container Smart fornece o contexto, e apenas os Dumb Components que precisam dos dados os consomem diretamente (`useContext`).

### 🟡 PRIORIDADE MÉDIA: Monolito de Lógica no Frontend
* **O Problema:** O `GeradorEscala.jsx` ainda retém mais de 300 linhas puramente de gestão de estado e side-effects.
* **O Risco:** Violar o princípio da responsabilidade única (SRP), tornando a curva de aprendizagem mais difícil para novos desenvolvedores.
* **A Solução:** Extrair lógicas de domínio para Custom Hooks. Ex: criar `useVagas()` e `useDisponibilidades()`, deixando o componente React apenas responsável por compor os sub-componentes.

### 🔵 PRIORIDADE BAIXA: Controle de Acessos (RBAC) Hardcoded
* **O Problema:** O `security.py` valida acessos verificando literalmente `if current_user.get("role") != "admin":`.
* **O Risco:** Abordagem inflexível. Dificulta a criação de novos níveis de permissão no futuro (ex: `lider_louvor`, `membro_comum`).
* **A Solução:** Criar um Enum (enumerador) de Roles robusto em Python e expandir o modelo de dependências de segurança do FastAPI.
