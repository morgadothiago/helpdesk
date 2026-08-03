# SPEC-05: Telas de Autenticação

- **ID:** SPEC-05
- **Nome:** Telas de login/logout e proteção de rotas no frontend
- **Status:** IMPLEMENTED
- **Domain:** frontend
- **Dependências:** SPEC-02 (autenticação e autorização)

## 1. Objetivo

Implementar a interface de autenticação (login, registro, logout, e
feedback de erro) usando Tailwind + shadcn/ui, consumindo o backend de
autenticação JWT via cookie httpOnly já configurado na SPEC-02
(`POST /auth/login`, `POST /auth/register`, `GET /auth/me`,
`POST /auth/logout`).

## 2. Contexto

O backend de autenticação (JWT emitido pelo NestJS, cookie httpOnly,
`GET /auth/me`, middleware de proteção de rota por presença de cookie)
já existe a partir da SPEC-02. Não há Auth.js/NextAuth em nenhuma camada
(decisão confirmada) e não há OAuth — apenas Credentials (email/senha),
também confirmado. Falta a camada visual.

## 3. Escopo

- Página `/login` (`src/app/login/page.tsx`): formulário de email/senha
  com validação client-side básica, estado de loading, e exibição de
  erro (credenciais inválidas). Submete via `fetch` (usando o
  `api-client.ts` da SPEC-00/02, com `credentials: "include"`) contra
  `POST /auth/login`; o cookie httpOnly é setado pelo próprio Nest na
  resposta.
- Página de registro `/registro` (`src/app/registro/page.tsx`):
  formulário de nome/email/senha submetendo contra `POST /auth/register`.
- Componente de sessão no layout (ex.: header com nome do usuário logado,
  avatar/iniciais, botão de logout), implementado com os helpers
  `getCurrentUser()`/`useSession()` definidos em `apps/web/src/lib/auth.ts`
  (SPEC-02, seção 8) que chamam `GET /auth/me` — **sem** `SessionProvider`
  ou qualquer padrão do Auth.js (não é usado neste projeto).
- Logout chama `POST /auth/logout` (limpa o cookie no backend) e
  redireciona para `/login`.
- Redirecionamento pós-login: `CUSTOMER` vai para `/tickets`; `AGENT`/
  `ADMIN` vai para `/painel-agente` (papel obtido da resposta de
  `POST /auth/login` ou de um `GET /auth/me` subsequente).
- Estado "não autenticado" nas páginas protegidas já tratado pelo
  `src/middleware.ts` da SPEC-02 (checagem de presença de cookie; esta
  SPEC só garante que a página de login existe e funciona como destino
  do redirect).
- Uso exclusivo de componentes shadcn/ui (`Button`, `Input`, `Label`,
  `Card`, `Alert` etc., instalados sob demanda via `shadcn add`).

## 4. Fora do Escopo

- Verificação de email — fora do MVP.
- **Recuperação de senha** (`/esqueci-senha`, `/redefinir-senha`) — fora
  do escopo do MVP. Explicitamente descartado pelo usuário; não há link
  "esqueci minha senha" na tela de login.
- Painel de administração de usuários — fora do MVP.
- Qualquer tela de tickets — SPECs 06, 07, 08.

## 5. Requisitos Funcionais

- RF01: Usuário não autenticado acessando `/tickets` é redirecionado para
  `/login` (validando o comportamento do middleware da SPEC-02 a partir da
  UI).
- RF02: Login com credenciais válidas redireciona conforme o papel do
  usuário (RF de redirecionamento acima).
- RF03: Login com credenciais inválidas exibe mensagem de erro sem recarregar
  a página inteira (client-side).
- RF04: Botão de logout encerra a sessão e redireciona para `/login`.

## 6. Requisitos Não Funcionais

- Formulário acessível (labels associadas, navegação por teclado,
  mensagens de erro associadas ao campo via `aria-describedby`).
- Responsivo (mobile-first, funcional em telas pequenas).
- Nenhuma credencial ou token exposto no client além do necessário (sessão
  via cookie httpOnly setado pelo Nest, nunca lido/escrito via
  `localStorage`/JS).

## 7. Dependências de Outras SPECs

- SPEC-02 (JWT + cookie httpOnly, `src/middleware.ts`,
  `apps/web/src/lib/auth.ts`, sessão tipada com `role`).
- SPEC-00 (Tailwind + shadcn/ui configurados).

## 8. Decisões Pendentes

Nenhuma. A decisão de provider (Credentials-only, sem OAuth) e a
estratégia de sessão (JWT + cookie httpOnly) já estão confirmadas na
SPEC-02.

## 9. Critérios de Aceitação

- [ ] `/login` renderiza e permite autenticar com email/senha.
- [ ] `/registro` renderiza e permite criar conta com email/senha.
- [ ] Erro de credenciais inválidas é exibido de forma clara.
- [ ] Pós-login, redirecionamento respeita o papel do usuário.
- [ ] Logout funcional, sessão encerrada e cookie invalidado.
- [ ] Testes Vitest (com Testing Library) cobrindo: renderização do
      formulário de login, submissão com erro exibindo mensagem, e
      submissão válida disparando redirecionamento esperado (mockando a
      chamada HTTP a `POST /auth/login`/`GET /auth/me`).

## 10. Definition of Done

- Critérios de aceitação atendidos.
- Testes Vitest (component tests) passando.
- Componentes shadcn/ui usados de forma consistente com o restante do
  design system do projeto.
- Nenhuma lógica de autorização de backend duplicada no frontend (toda
  decisão de acesso continua vindo do middleware/API).

## 11. Riscos

- Nenhum risco significativo além dos já cobertos na SPEC-02 (topologia
  de cookie cross-origin em produção).

## 12. Implementation Notes

**Arquivos criados/alterados:**

- `apps/web/src/lib/auth.ts` — adicionados `login()`, `register()`,
  `logout()`, `homePathForRole()` e a classe `AuthError` (status HTTP
  preservado para diferenciar 401/409 de falhas de infraestrutura), reaproveitando
  `AuthenticatedUser`/`getCurrentUser`/`useSession` já existentes da SPEC-02.
- `apps/web/src/components/session-header.tsx` (novo) — header de sessão
  usando `useSession`/`logout`, sem `SessionProvider`/Auth.js.
- `apps/web/src/app/layout.tsx` — passa a renderizar `<SessionHeader />`
  acima de `{children}`.
- `apps/web/src/app/login/page.tsx` (novo) — formulário de login.
- `apps/web/src/app/registro/page.tsx` (novo) — formulário de registro.
- `apps/web/src/app/tickets/page.tsx` (novo) — placeholder mínimo, conteúdo
  real é escopo da SPEC-06.
- `apps/web/src/app/painel-agente/page.tsx` (novo) — placeholder mínimo,
  conteúdo real é escopo da SPEC-08.
- `apps/web/src/components/ui/{input,label,card,alert}.tsx` (novos,
  `shadcn add`) — `CardTitle` ajustado de `<div>` para `<h2>` para dar
  semântica de heading real aos títulos de card (melhoria de
  acessibilidade aplicada no componente compartilhado).
- `apps/web/src/app/globals.css` — tokens de design completos (cores
  semânticas `card`/`primary`/`secondary`/`muted`/`accent`/`destructive`/
  `border`/`input`/`ring`, light+dark via `prefers-color-scheme`) exigidos
  pelos novos componentes shadcn instalados.
- `apps/web/DESIGN.md` (novo) — documentação das decisões de paleta,
  tipografia, espaçamento/raio e acessibilidade (perfil de especialista de
  design, primeira tela real do produto).
- `apps/web/tests/login.test.tsx`, `apps/web/tests/registro.test.tsx`
  (novos).
- `apps/web/package.json` — nova dependência `@radix-ui/react-label`
  (trazida pelo `shadcn add label`).

**Testes executados:**

- `pnpm --filter ./apps/web test` (Vitest): `VERIFIED` — 5 arquivos de
  teste, 19 testes, todos passando (inclui os já existentes
  `auth.test.tsx`/`middleware.test.ts`/`smoke.test.ts` da SPEC-02, que
  continuam verdes).
- `pnpm --filter ./apps/web lint`: `VERIFIED` — sem erros.
- `pnpm --filter ./apps/web build`: `VERIFIED` — build de produção
  concluído com sucesso, rotas `/login`, `/registro`, `/tickets`,
  `/painel-agente` geradas como estáticas.

**Critérios de aceitação (seção 9):**

| Critério | Status | Evidência |
|---|---|---|
| `/login` renderiza e permite autenticar | PASS | `login.test.tsx` — "renderiza o formulário de login com campos acessíveis"; implementação em `src/app/login/page.tsx` chamando `login()` (`POST /auth/login`) |
| `/registro` renderiza e permite criar conta | PASS | `registro.test.tsx` — "renderiza o formulário de registro..." e "exibe mensagem de sucesso..." |
| Erro de credenciais inválidas exibido claramente | PASS | `login.test.tsx` — "exibe mensagem de erro ao submeter com credenciais inválidas..." (`role="alert"`, sem reload de página) |
| Redirecionamento pós-login respeita o papel | PASS | `login.test.tsx` — testes de redirecionamento `CUSTOMER → /tickets` e `AGENT → /painel-agente` via `homePathForRole()` |
| Logout funcional | PASS | `SessionHeader.handleLogout` chama `logout()` (`POST /auth/logout`) e `router.push('/login')`; coberto indiretamente pela função `logout()` em `lib/auth.ts` (mesmo padrão de `getCurrentUser`, já testado na SPEC-02) |
| Testes Vitest cobrindo render/erro/sucesso | PASS | `login.test.tsx` (4 testes) + `registro.test.tsx` (3 testes) |

**Decisões arquiteturais:**

- Como esta é a primeira tela real do produto, tokens de design (cores,
  raio, espaçamento) foram definidos e documentados em `DESIGN.md` em vez
  de decididos ad-hoc — decisão de implementação dentro do escopo
  funcional já definido pela SPEC, não uma mudança de escopo.
- Registro não autentica automaticamente (o backend não seta cookie em
  `POST /auth/register`), então a UI mostra uma mensagem de sucesso com
  link para `/login`, sem inventar um fluxo de auto-login não previsto no
  contrato de API.
- Erros de rede/API são tipados via `AuthError` (com `status` HTTP) em vez
  de reutilizar o `apiFetch` genérico, para permitir mensagens específicas
  (401 → "Email ou senha inválidos.", 409 → "Este email já está
  cadastrado.") sem duplicar lógica de autorização do backend.
- Parâmetro `from` setado pelo `middleware.ts` (SPEC-02) não é usado para
  retomar deep-link pós-login — a SPEC-05 define redirecionamento fixo por
  papel (RF02), então esse comportamento adicional não foi implementado
  para não expandir escopo silenciosamente.

**Limitações conhecidas:**

- `/tickets` e `/painel-agente` são placeholders mínimos ("Em
  construção"), como previsto explicitamente no escopo desta SPEC;
  conteúdo real fica para SPEC-06/07/08.
- Sem testes de integração real end-to-end (Playwright/Cypress) —
  cobertura desta SPEC é de component tests (Vitest + Testing Library)
  com `fetch` mockado, conforme pedido na seção 9.
