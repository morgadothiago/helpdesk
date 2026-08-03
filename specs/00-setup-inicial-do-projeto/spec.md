# SPEC-00: Setup Inicial do Projeto

- **ID:** SPEC-00
- **Nome:** Setup inicial do projeto (monorepo apps/api + apps/web)
- **Status:** APPROVED
- **Domain:** fullstack
- **Dependências:** nenhuma

## 1. Objetivo

Criar o scaffolding completo do projeto helpdesk como um **monorepo** com
backend e frontend **separados**, estabelecendo a base técnica (stack,
ferramentas, estrutura de pastas, ambiente de desenvolvimento) sobre a qual
todas as demais SPECs serão implementadas. Nenhuma funcionalidade de negócio
(tickets, usuários, autenticação, etc.) é implementada aqui — apenas a
fundação.

## 2. Contexto

Esta SPEC substitui integralmente a versão anterior (Next.js full-stack
monolito com API routes). O usuário revogou explicitamente aquela decisão
de arquitetura. Nenhum código chegou a ser implementado com a versão
anterior (repositório vazio, apenas specs em `DRAFT`), portanto não há
migração de código — apenas a reescrita das SPECs.

**Nova decisão de arquitetura (CONFIRMED pelo usuário, não sujeita a nova
validação):**

| Decisão | Escolha |
|---|---|
| Arquitetura | Monorepo com backend e frontend separados |
| Backend | NestJS + Swagger/OpenAPI (documentação automática) + Prisma como ORM |
| Frontend | Next.js (App Router), apenas client HTTP consumindo a API NestJS — **sem API routes de negócio no Next.js** |
| Estrutura de pastas | `apps/api` (NestJS), `apps/web` (Next.js) |
| Gerenciador de pacotes / workspaces | pnpm workspaces |

**Decisões anteriores que continuam válidas (CONFIRMED):**

| Decisão | Escolha |
|---|---|
| ORM | Prisma (agora vive dentro de `apps/api`) |
| UI | Tailwind CSS + shadcn/ui (em `apps/web`) |
| Banco de dados | PostgreSQL — Docker local em dev; banco gerenciado (Neon/Supabase/Vercel Postgres) em produção |
| Gerenciador de pacotes | pnpm |

**Decisões revogadas pela mudança de arquitetura:**

- Next.js full-stack com API routes de negócio — revogado. Next.js agora é
  puramente client (App Router + fetch/HTTP para a API Nest).
- Auth.js (NextAuth v5) rodando dentro do Next.js full-stack — reavaliado
  e descartado na SPEC-02 (decisão confirmada: JWT emitido pelo NestJS).
  Nesta SPEC-00 nenhum mecanismo de autenticação é implementado; apenas o
  scaffolding vazio de ambos os apps.

## 3. Escopo

### 3.1 Estrutura de monorepo (raiz)

- `pnpm-workspace.yaml` declarando `apps/*` como workspaces.
- `package.json` de raiz com scripts que orquestram os dois apps via
  `pnpm --filter` (ver decisão de orquestração abaixo).
- `docker-compose.yml` na raiz com serviço Postgres único, compartilhado
  por todo o monorepo (usado apenas por `apps/api`).
- `.env.example` de raiz documentando `DATABASE_URL` (uso do Docker
  Compose) — cada app também terá seu próprio `.env.example` local para as
  variáveis específicas dele (ver seção 8).
- `.gitignore` de raiz cobrindo `node_modules`, `.env`, `.next`, `dist`,
  `.turbo` (se aplicável).
- `README.md` de raiz com instruções de setup do monorepo completo
  (instalar deps na raiz, subir Postgres via Docker, rodar migrations,
  rodar os dois apps em dev, rodar testes de ambos).
- ESLint + Prettier configurados de forma consistente entre os dois apps
  (config compartilhada na raiz ou config própria por app — a critério do
  dev-backend/dev-frontend na implementação, desde que documentada).

### 3.2 Orquestração de scripts (dev/build/test)

Scripts de raiz usando **`pnpm --filter`** diretamente (sem Turborepo)
para orquestrar os dois apps. Justificativa: o monorepo tem apenas dois
pacotes (`apps/api`, `apps/web`) sem grafo de dependências internas entre
eles (não compartilham pacotes internos ainda) e sem necessidade, neste
estágio do MVP, de cache de build distribuído ou pipelines paralelos
complexos — que é o principal valor agregado do Turborepo. `pnpm --filter`
resolve a orquestração básica (`--filter=./apps/api`, `--parallel`, etc.)
sem adicionar uma ferramenta e um arquivo de configuração (`turbo.json`)
extras à base do projeto. Se o monorepo crescer (pacotes compartilhados
como `packages/types`, necessidade de build cache), Turborepo pode ser
proposto como SPEC futura — não é uma decisão fechada para sempre, apenas
a mais simples que atende ao MVP.

Scripts de raiz (`package.json`):

\`\`\`json
{
  "scripts": {
    "dev": "pnpm --parallel --filter ./apps/* dev",
    "dev:api": "pnpm --filter ./apps/api dev",
    "dev:web": "pnpm --filter ./apps/web dev",
    "build": "pnpm --filter ./apps/api build && pnpm --filter ./apps/web build",
    "test": "pnpm --filter ./apps/api test && pnpm --filter ./apps/web test",
    "test:api": "pnpm --filter ./apps/api test",
    "test:web": "pnpm --filter ./apps/web test",
    "lint": "pnpm --filter ./apps/api lint && pnpm --filter ./apps/web lint",
    "db:up": "docker compose up -d",
    "db:down": "docker compose down",
    "prisma:generate": "pnpm --filter ./apps/api prisma:generate",
    "prisma:migrate": "pnpm --filter ./apps/api prisma:migrate"
  }
}
\`\`\`

### 3.3 `apps/api` (NestJS)

- Scaffold de projeto NestJS + TypeScript (`@nestjs/core`,
  `@nestjs/common`, `@nestjs/platform-express`), gerenciado com pnpm.
- Swagger/OpenAPI habilitado via `@nestjs/swagger`, expondo documentação
  interativa em `/docs` (ou `/api/docs`) — sem nenhum módulo de negócio
  documentado ainda, apenas o setup do `DocumentBuilder`/`SwaggerModule`
  no `main.ts` e um endpoint trivial de health-check (`GET /health`) só
  para validar que a aplicação sobe e aparece no Swagger.
- Prisma inicializado (`prisma init`) dentro de `apps/api`, com
  `schema.prisma` contendo apenas datasource e generator — **sem models de
  negócio** (isso é escopo da SPEC-01).
- `PrismaService` básico (módulo Nest que encapsula o `PrismaClient` como
  provider injetável) — sem uso ainda por nenhum módulo de negócio.
- CORS habilitado no Nest, restrito à origem do `apps/web`
  (`http://localhost:3001` em dev, configurável via env).
- `ValidationPipe` global configurado (`whitelist: true`,
  `forbidNonWhitelisted: true`) — preparação para DTOs das próximas SPECs.
- Scripts próprios em `apps/api/package.json`: `dev` (`nest start
  --watch`), `build`, `start:prod`, `lint`, `test`, `test:watch`,
  `prisma:generate`, `prisma:migrate`.
- Testes: ver decisão pendente na seção 10 (Jest vs Vitest).

### 3.4 `apps/web` (Next.js)

- Scaffold de projeto Next.js (App Router) + TypeScript, gerenciado com
  pnpm, rodando em porta distinta da API (ex.: `3001`, com a API em
  `3000`, ou o inverso — documentar a escolha final no `.env.example`).
- Configuração do Tailwind CSS e inicialização do shadcn/ui (sem
  componentes de negócio, apenas setup + 1-2 componentes de exemplo do
  próprio shadcn para validar a instalação, ex.: `button`).
- Cliente HTTP básico (`src/lib/api-client.ts` ou similar) apontando para
  a URL base da API Nest via variável de ambiente
  (`NEXT_PUBLIC_API_URL`), com um wrapper mínimo de `fetch` (sem lógica de
  autenticação/negócio — isso é escopo da SPEC-02 em diante). Um único
  teste smoke chamando `GET /health` da API para validar a integração de
  ponta a ponta é aceitável nesta SPEC.
- **Nenhuma rota sob `src/app/api/**`** — reforça a regra "sem API routes
  de negócio no Next.js". Se alguma rota mínima de infraestrutura (ex.:
  proxy para setar cookie httpOnly) vier a ser necessária, isso é decisão
  da SPEC-02, não desta SPEC-00.
- Scripts próprios em `apps/web/package.json`: `dev`, `build`, `start`,
  `lint`, `test`, `test:watch`.
- Testes: Vitest (mantido, ver seção 10).

## 4. Fora do Escopo

- Qualquer model de domínio no Prisma (User, Ticket, Comment, etc.) —
  SPEC-01.
- Qualquer mecanismo de autenticação/autorização (Auth.js, JWT, guards,
  etc.) — SPEC-02.
- Qualquer tela de negócio (login customizado, listagem de tickets, etc.).
- Qualquer endpoint de API de negócio (controllers de tickets,
  comentários, etc.).
- CI/CD (pipeline de deploy, GitHub Actions, etc.) — pode virar SPEC
  futura se o usuário solicitar.
- Configuração de banco gerenciado em produção (Neon/Supabase/Vercel
  Postgres) — apenas documentar a variável `DATABASE_URL` como
  configurável por ambiente; a criação/contratação do banco gerenciado é
  ação manual do usuário fora do escopo de código.
- Turborepo ou qualquer outra ferramenta de build orchestration além de
  `pnpm --filter` (ver justificativa na seção 3.2).

## 5. Requisitos Funcionais

Não aplicável (SPEC de infraestrutura/scaffolding, sem funcionalidade de
negócio).

## 6. Requisitos Não Funcionais

- `pnpm install` na raiz deve instalar as dependências de ambos os apps
  (via workspaces) sem erro em ambiente limpo.
- `pnpm dev` na raiz deve subir `apps/api` e `apps/web` simultaneamente,
  sem erros no console.
- `pnpm build` na raiz deve gerar build de produção de ambos os apps sem
  erros de tipo ou lint bloqueante.
- `docker compose up -d` (raiz) deve subir um Postgres acessível
  localmente, compatível com a `DATABASE_URL` documentada.
- `GET /health` em `apps/api` deve responder `200` e aparecer documentado
  no Swagger (`/docs`).
- `apps/web` deve renderizar sua home (`/`) sem erro e conseguir chamar
  `GET /health` da API com sucesso (prova de integração de rede entre os
  dois apps).
- `pnpm test` na raiz deve executar as suítes de teste de ambos os apps e
  passar (smoke tests verdes).
- Código em TypeScript com `strict: true` no `tsconfig.json` de ambos os
  apps.
- `apps/web` nunca acessa o Postgres diretamente nem importa o Prisma
  Client de `apps/api` — toda comunicação é via HTTP contra a API Nest.

## 7. Estrutura de Pastas Esperada

\`\`\`
helpdesk/
├── .env.example
├── .gitignore
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── README.md
├── specs/
│   └── ...
├── apps/
│   ├── api/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── nest-cli.json
│   │   ├── .env.example
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── src/
│   │   │   ├── main.ts               # bootstrap + Swagger setup + CORS
│   │   │   ├── app.module.ts
│   │   │   ├── health/
│   │   │   │   ├── health.controller.ts
│   │   │   │   └── health.module.ts
│   │   │   └── prisma/
│   │   │       ├── prisma.service.ts
│   │   │       └── prisma.module.ts
│   │   └── test/
│   │       └── health.e2e-spec.ts    # ou .spec.ts, conforme decisão da seção 10
│   └── web/
│       ├── package.json
│       ├── tsconfig.json
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── vitest.config.ts
│       ├── .env.example
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx
│       │   │   └── page.tsx
│       │   ├── components/
│       │   │   └── ui/               # componentes shadcn/ui
│       │   └── lib/
│       │       ├── api-client.ts     # cliente HTTP básico → NEXT_PUBLIC_API_URL
│       │       └── utils.ts
│       └── tests/
│           └── smoke.test.ts
\`\`\`

## 8. Variáveis de Ambiente

### Raiz (`.env.example`) — usado pelo `docker-compose.yml`

\`\`\`
POSTGRES_USER=helpdesk
POSTGRES_PASSWORD=helpdesk
POSTGRES_DB=helpdesk
POSTGRES_PORT=5432
\`\`\`

### `apps/api/.env.example`

\`\`\`
DATABASE_URL="postgresql://helpdesk:helpdesk@localhost:5432/helpdesk?schema=public"
PORT=3000
CORS_ORIGIN="http://localhost:3001"
\`\`\`

### `apps/web/.env.example`

\`\`\`
NEXT_PUBLIC_API_URL="http://localhost:3000"
\`\`\`

## 9. Dependências de Outras SPECs

Nenhuma. Esta é a SPEC fundacional.

## 10. Decisão de Testes (CONFIRMED)

**Decisão do usuário: Jest em `apps/api` (padrão oficial do NestJS,
`@nestjs/testing`, TestingModule, convenção `*.spec.ts`/`*.e2e-spec.ts`) e
Vitest em `apps/web`.**

Isso confirma a recomendação original do orquestrador. Não há mais
`[NEEDS_DECISION]` nesta SPEC.

Impacto: define as devDependencies de `apps/api` (`@nestjs/testing`,
`jest`, `ts-jest`/`@swc/jest`), o `nest-cli.json`/`package.json` de teste,
e o conteúdo de `apps/api/test/`. `apps/web` usa `vitest`,
`@testing-library/react` conforme já previsto na seção 3.4.

## 11. Critérios de Aceitação

- [ ] `pnpm install` na raiz instala as dependências de `apps/api` e
      `apps/web` sem erro.
- [ ] `pnpm dev` sobe `apps/api` (porta da API) e `apps/web` (porta do
      frontend) simultaneamente, sem erros.
- [ ] `docker compose up -d` sobe um Postgres saudável e acessível via a
      `DATABASE_URL` de `apps/api/.env.example`.
- [ ] `pnpm prisma:generate` e `pnpm prisma:migrate` (migration
      vazia/inicial) rodam sem erro contra o Postgres local, a partir da
      raiz (delegando para `apps/api`).
- [ ] `GET http://localhost:<porta-api>/health` responde `200`.
- [ ] `GET http://localhost:<porta-api>/docs` (Swagger) responde e exibe
      ao menos o endpoint de health.
- [ ] `apps/web` renderiza a home em `http://localhost:<porta-web>` sem
      erro e exibe (ou loga) com sucesso o resultado da chamada a
      `GET /health` da API.
- [ ] `pnpm test` (raiz) executa as suítes de `apps/api` e `apps/web` e
      ambas passam (smoke tests verdes).
- [ ] `pnpm lint` (raiz) roda sem erros bloqueantes em ambos os apps.
- [ ] `pnpm build` (raiz) conclui com sucesso para ambos os apps.
- [ ] Estrutura de pastas confere com a seção 7.
- [ ] `.env.example` (raiz e de cada app) documenta todas as variáveis
      necessárias para rodar o projeto localmente.
- [ ] `README.md` de raiz permite que outro desenvolvedor rode o monorepo
      completo do zero seguindo apenas as instruções.
- [ ] Nenhuma rota sob `apps/web/src/app/api/**` foi criada.

## 12. Definition of Done

- Todos os critérios de aceitação da seção 11 atendidos.
- Testes implementados e passando em ambos os apps (framework de teste do
  backend conforme decisão da seção 10; Vitest no frontend).
- Nenhum código de negócio (models, telas, endpoints de tickets/usuários,
  autenticação) incluído.
- Decisão da seção 10 confirmada pelo usuário (Jest em `apps/api`, Vitest
  em `apps/web`).
- `status` desta SPEC atualizado para `IMPLEMENTED` somente após validação
  do project-orchestrator.

## 13. Riscos

- Divergência entre Postgres local (Docker) e banco gerenciado em produção
  (ex.: extensões, versão do Postgres) — mitigar fixando a versão da imagem
  Docker igual à versão suportada pelo provedor gerenciado escolhido no
  futuro.
- Duas ferramentas de teste distintas no monorepo (se a recomendação da
  seção 10 for aceita) podem exigir onboarding um pouco maior para novos
  desenvolvedores — mitigado documentando claramente no `README.md` qual
  ferramenta roda em qual app e por quê.
- CORS mal configurado entre `apps/web` e `apps/api` é uma fonte comum de
  bugs de integração em setups separados — mitigar com teste smoke de
  integração (chamada real do web para a api) já nesta SPEC-00, não
  deixar para descobrir depois.
