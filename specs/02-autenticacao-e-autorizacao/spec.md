# SPEC-02: Autenticação e Autorização

- **ID:** SPEC-02
- **Nome:** Autenticação e autorização por papéis (JWT emitido pelo NestJS)
- **Status:** IMPLEMENTED
- **Domain:** fullstack
- **Dependências:** SPEC-00 (setup inicial), SPEC-01 (modelagem de dados)

## 1. Objetivo

Implementar autenticação e autorização por papéis para o MVP de helpdesk,
com o backend NestJS (`apps/api`) como única fonte de verdade de
identidade: emissão de token JWT via endpoints próprios
(`/auth/register`, `/auth/login`), guards/decorators de papel reutilizáveis
por toda a API, e, do lado do frontend Next.js (`apps/web`), o consumo
desse token de forma segura sem reintroduzir API routes de negócio.

## 2. Contexto

A versão anterior desta SPEC assumia Auth.js (NextAuth v5) rodando dentro
de um Next.js full-stack monolítico. Com a nova arquitetura de monorepo
separado (SPEC-00: backend NestJS + frontend Next.js client puro), essa
premissa não se sustenta mais sem adaptação: Auth.js foi desenhado para
rodar como parte de uma aplicação Next.js com acesso a route handlers e,
tipicamente, acesso direto ao banco via adapter — o que conflita com a
regra "sem API routes de negócio no Next.js" e com "apps/web não acessa o
banco diretamente" (SPEC-01).

Esta SPEC reavalia essa decisão e propõe formalmente a alternativa de JWT
emitido pelo próprio NestJS, tratando isso como decisão a confirmar antes
da aprovação (ver seção 9).

## 3. Decisão de Auth (CONFIRMED — ver seção 9)

**JWT emitido pelo NestJS via Passport, sem Auth.js/NextAuth em nenhuma
camada do sistema.**

- Backend (`apps/api`):
  - `@nestjs/passport` + `passport-local` (estratégia de login por
    email/senha) + `passport-jwt` (estratégia de validação de token nas
    rotas protegidas) + `@nestjs/jwt`.
  - `POST /auth/register` — cria `User` com senha hasheada (`bcrypt`),
    `role: CUSTOMER` por padrão.
  - `POST /auth/login` — valida credenciais (`LocalStrategy`), emite JWT
    assinado contendo `sub` (id do usuário) e `role`, com expiração
    configurável (`JWT_EXPIRES_IN`).
  - `GET /auth/me` — retorna os dados do usuário autenticado a partir do
    token (usado pelo frontend para hidratar sessão no client).
  - `JwtStrategy` valida o token em toda rota protegida via
    `@UseGuards(JwtAuthGuard)`.
  - Decorator `@Roles(...roles: Role[])` + `RolesGuard` (lê metadata do
    decorator, compara com `request.user.role`) para autorização por
    papel nas rotas de negócio das SPECs seguintes (03, 04, etc.).
  - Regras de negócio de autorização (a serem aplicadas pelas SPECs de
    API 03/04):
    - `CUSTOMER` só pode ver/criar/comentar nos próprios tickets.
    - `AGENT` pode ver todos os tickets, atribuir a si mesmo, mudar
      status/prioridade, comentar em qualquer ticket.
    - `ADMIN` tem todos os poderes de `AGENT` e pode reatribuir tickets
      entre agentes.

- Frontend (`apps/web`) — **como armazenar/enviar o token sem reintroduzir
  API routes de negócio no Next.js:**

  Opção recomendada: **cookie httpOnly setado diretamente pelo próprio
  NestJS**, não pelo Next.js.
  - `POST /auth/login` (no Nest) responde com `Set-Cookie` (`httpOnly`,
    `secure` em produção, `sameSite=lax`, com o JWT como valor), além do
    corpo JSON normal. Isso evita expor o token a JavaScript no browser
    (mitiga XSS) sem exigir nenhuma rota própria do Next.js.
  - Para que o cookie seja enviado nas chamadas subsequentes de
    `apps/web` para `apps/api`, o cliente HTTP do frontend usa
    `credentials: "include"` e o CORS do Nest (SPEC-00) precisa
    `credentials: true` com origem explícita (não `*`).
  - O Next.js lê o estado de "autenticado" chamando `GET /auth/me` (Server
    Component ou client-side, repassando o cookie automaticamente pelo
    browser / `cookies()` do Next em Server Components) — sem guardar
    nada em `localStorage`.
  - **Nenhuma rota é criada em `apps/web/src/app/api/**`.** O único ponto
    que seta o cookie é o backend Nest. Isso respeita integralmente a
    regra "sem API routes de negócio no Next.js" da SPEC-00, porque não é
    uma rota de negócio — é o próprio backend definindo o cookie na
    resposta HTTP do login, como qualquer API cross-origin com cookie
    httpOnly faz.
  - Middleware do Next.js (`src/middleware.ts`) lê a presença do cookie
    (sem validar a assinatura do JWT no edge — apenas checagem de
    presença, para UX de redirecionamento) para proteger rotas como
    `/tickets/**` e `/painel-agente/**`, redirecionando para `/login` se
    ausente. A validação real e autoritativa do token acontece sempre no
    backend Nest (guards), nunca confiada ao middleware do Next.

  Alternativa descartada nesta proposta: manter Auth.js no Next.js
  "por baixo" chamando a API Nest. Descartada porque adicionaria uma
  segunda camada de sessão (a do Auth.js) por cima da autoridade real
  (o Nest), duplicando lógica de expiração/refresh sem necessidade real
  para o escopo do MVP, e reintroduziria dependência de adapter/rotas
  dentro do Next.js que a nova arquitetura busca eliminar.

## 4. Escopo

- Módulo `AuthModule` em `apps/api` com `AuthController`, `AuthService`,
  `LocalStrategy`, `JwtStrategy`.
- `POST /auth/register`, `POST /auth/login`, `GET /auth/me` documentados
  no Swagger (SPEC-00 já habilitou o Swagger, esta SPEC adiciona os DTOs
  e anotações destes três endpoints).
- `JwtAuthGuard` e `RolesGuard` + decorator `@Roles()` reutilizáveis por
  toda a API.
- Hash de senha com `bcrypt` no `AuthService` (registro e validação de
  login).
- Cookie httpOnly setado pelo `POST /auth/login` (e limpo por um
  `POST /auth/logout`).
- CORS do Nest ajustado para `credentials: true` com origem explícita
  (complementa a config básica da SPEC-00).
- No `apps/web`: `src/middleware.ts` para proteção de rotas por presença
  de cookie; extensão do `api-client.ts` da SPEC-00 para sempre enviar
  `credentials: "include"`; hook/helper client-side (ex.:
  `useSession()`/`getCurrentUser()`) que chama `GET /auth/me`.
- Tipagem compartilhada mínima do payload de usuário autenticado (pode
  ser duplicada manualmente entre `apps/api` e `apps/web` neste MVP — um
  pacote `packages/types` compartilhado é uma otimização futura, fora de
  escopo aqui).

## 5. Fora do Escopo

- Tela de login/registro (frontend, componente visual) — SPEC-05.
- Painel de administração para promover usuários a `AGENT`/`ADMIN` (fora
  do MVP; pode ser SPEC futura — por ora, promoção de papel é feita via
  seed ou acesso direto ao banco).
- Verificação de email — fora do MVP.
- **Recuperação de senha** ("esqueci minha senha", `forgot-password`/
  `reset-password`, `PasswordResetToken`, `EmailService`) — fora do
  escopo do MVP. Explicitamente descartado pelo usuário; não faz parte
  desta SPEC nem de nenhuma outra.
- Refresh token / rotação de token — fora do MVP; o JWT tem expiração
  fixa configurável e o usuário simplesmente faz login novamente ao
  expirar.
- Auth.js/NextAuth em qualquer camada — descartado por esta SPEC, salvo
  decisão em contrário do usuário na seção 9.

## 6. Requisitos Funcionais

- RF01: `POST /auth/register` cria um `User` com senha hasheada e
  `role: CUSTOMER`; falha com 409 se o email já existir.
- RF02: `POST /auth/login` com credenciais corretas retorna 200, corpo
  com dados do usuário (sem senha) e `Set-Cookie` com o JWT; com
  credenciais incorretas retorna 401.
- RF03: `GET /auth/me` sem cookie válido retorna 401; com cookie válido
  retorna os dados do usuário autenticado (id, name, email, role).
- RF04: Rota protegida com `@UseGuards(JwtAuthGuard, RolesGuard)` e
  `@Roles('AGENT','ADMIN')` retorna 403 para usuário com `role: CUSTOMER`
  autenticado, e 200/dados normalmente para `AGENT`/`ADMIN`.
- RF05: `POST /auth/logout` limpa o cookie (idempotente).
- RF06: Acessar `/tickets/**` ou `/painel-agente/**` em `apps/web` sem
  cookie de sessão redireciona para `/login`.

## 7. Requisitos Não Funcionais

- Senhas nunca armazenadas em texto plano — hash obrigatório (`bcrypt`,
  custo mínimo 10).
- `JWT_SECRET` obrigatório e validado na inicialização do Nest (falha
  explícita se ausente).
- Cookie do JWT sempre `httpOnly`; `secure: true` obrigatório em produção
  (`NODE_ENV=production`).
- Nenhuma informação sensível (hash de senha) deve vazar em `GET
  /auth/me` ou em qualquer resposta de API.
- CORS do Nest não pode usar `origin: "*"` quando `credentials: true`
  estiver habilitado (requisito técnico do próprio spec de CORS, não é
  opcional).

## 8. Arquitetura

- `apps/api/src/auth/auth.module.ts`, `auth.controller.ts`,
  `auth.service.ts`, `strategies/local.strategy.ts`,
  `strategies/jwt.strategy.ts`, `guards/jwt-auth.guard.ts`,
  `guards/roles.guard.ts`, `decorators/roles.decorator.ts`.
- `apps/web/src/middleware.ts`: checagem de presença de cookie para
  redirecionamento de UX (não é fonte de verdade de autorização).
- `apps/web/src/lib/api-client.ts` (estendido da SPEC-00): sempre
  `credentials: "include"`.
- `apps/web/src/lib/auth.ts` (novo): helpers `getCurrentUser()` /
  `useSession()` que chamam `GET /auth/me`.

## 9. Decisões Confirmadas (CONFIRMED)

**Auth flow:** confirmada a opção 1 — JWT emitido pelo NestJS (Passport
local + JWT strategy), entregue via cookie httpOnly setado pelo próprio
Nest no `POST /auth/login`, consumido por `apps/web` via
`credentials: "include"`, com sessão hidratada no client exclusivamente
via `GET /auth/me`. Sem Auth.js/NextAuth em nenhuma camada. Detalhada na
seção 3, sem alterações necessárias no restante desta SPEC.

**Auth provider:** confirmado **apenas Credentials (email + senha)**, sem
OAuth (Google/GitHub/etc.) no MVP. Esta SPEC já estava redigida
inteiramente sobre essa premissa (`POST /auth/register`/`POST
/auth/login` com email/senha, `bcrypt`) — nenhuma mudança necessária.

Impacto: define o conteúdo de todo o AuthModule do backend (já refletido
nas seções 3, 4, 6, 8), confirma que **não** existem tabelas
Account/Session/VerificationToken na SPEC-01, e confirma a forma como
`apps/web` gerencia sessão (seção 3). Não há mais `[NEEDS_DECISION]`
nesta SPEC.

## 10. Critérios de Aceitação

- [ ] `POST /auth/register` cria usuário com senha hasheada; rejeita
      email duplicado com 409.
- [ ] `POST /auth/login` com credenciais válidas seta cookie httpOnly e
      retorna dados do usuário (sem senha); com credenciais inválidas
      retorna 401.
- [ ] `GET /auth/me` retorna 401 sem cookie válido e dados corretos com
      cookie válido.
- [ ] `POST /auth/logout` limpa o cookie.
- [ ] `RolesGuard` bloqueia papel não autorizado com 403 e libera papel
      autorizado.
- [ ] Endpoints de auth aparecem documentados no Swagger (`/docs`).
- [ ] `apps/web`: acessar `/tickets` sem cookie de sessão redireciona
      para `/login`.
- [ ] Testes (framework definido na SPEC-00, Jest recomendado para
      `apps/api`) cobrindo: registro, login com sucesso/falha,
      `/auth/me` autenticado/não autenticado, `RolesGuard` com papel
      permitido e não permitido, hashing/validação de senha.
- [ ] Nenhuma rota criada em `apps/web/src/app/api/**`.

## 11. Definition of Done

- Critérios de aceitação da seção 10 atendidos.
- Testes implementados e passando.
- Nenhuma tela de login/registro (UI) implementada nesta SPEC (isso é
  SPEC-05).
- Decisões da seção 9 confirmadas pelo usuário (JWT + cookie httpOnly;
  Credentials-only, sem OAuth).

## 12. Riscos

- Regras de autorização mal centralizadas podem gerar inconsistência
  entre as SPECs de API (03, 04) — mitigar garantindo que `RolesGuard` +
  `@Roles()` sejam o único ponto de verificação de papel, reutilizado por
  todas as rotas.
- Cookie cross-origin (Nest em uma porta/domínio, Next em outra) exige
  configuração correta de CORS (`credentials: true`, origem explícita) e,
  em produção, domínios compatíveis com `sameSite`/`secure` — mitigar
  documentando claramente a topologia de domínios esperada em produção
  antes do deploy (ex.: mesmo domínio raiz com subdomínios, ou
  `sameSite=none` + `secure` se domínios totalmente distintos).
- Decisão revertida para Auth.js (opção 2 da seção 9) depois desta SPEC
  já implementada exigiria retrabalho significativo — por isso a decisão
  deve ser tomada antes da aprovação, não durante a implementação.
