# Helpdesk

Monorepo do projeto Helpdesk, com backend e frontend separados.

## Stack

| Camada | Tecnologia |
|---|---|
| Backend (`apps/api`) | NestJS + TypeScript + Prisma ORM + Swagger/OpenAPI |
| Frontend (`apps/web`) | Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui |
| Banco de dados | PostgreSQL (Docker local em dev; banco gerenciado em produção) |
| Workspaces | pnpm workspaces (`apps/*`) |
| Orquestração de scripts | `pnpm --filter` (sem Turborepo — ver `specs/00-setup-inicial-do-projeto/spec.md`, seção 3.2) |
| Testes | Jest (`apps/api`, padrão NestJS) / Vitest (`apps/web`) |

`apps/web` nunca acessa o Postgres diretamente nem importa o Prisma Client de
`apps/api`. Toda comunicação entre frontend e backend acontece via HTTP
contra a API NestJS.

## Estrutura

```
helpdesk/
├── apps/
│   ├── api/   # NestJS + Prisma + Swagger
│   └── web/   # Next.js + Tailwind + shadcn/ui
├── specs/     # especificações do projeto (SDD)
├── docker-compose.yml
└── package.json
```

## Pré-requisitos

- Node.js >= 20
- pnpm >= 9 (`corepack enable` ou `npm i -g pnpm`)
- Docker + Docker Compose (para o Postgres local)

## Setup do zero

1. Instalar as dependências de todo o monorepo (raiz + `apps/api` +
   `apps/web`, via pnpm workspaces):

   ```bash
   pnpm install
   ```

2. Copiar os arquivos de variáveis de ambiente de exemplo:

   ```bash
   cp .env.example .env
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   ```

3. Subir o Postgres local via Docker Compose:

   ```bash
   pnpm db:up
   ```

4. Gerar o Prisma Client e rodar as migrations (contra o Postgres local):

   ```bash
   pnpm prisma:generate
   pnpm prisma:migrate
   ```

5. Rodar os dois apps em modo desenvolvimento simultaneamente:

   ```bash
   pnpm dev
   ```

   - API (NestJS): http://localhost:3000
   - Documentação Swagger: http://localhost:3000/docs
   - Health check: http://localhost:3000/health
   - Web (Next.js): http://localhost:3001

   Para rodar cada app isoladamente: `pnpm dev:api` ou `pnpm dev:web`.

## Scripts de raiz

| Script | Descrição |
|---|---|
| `pnpm dev` | Sobe `apps/api` e `apps/web` em paralelo |
| `pnpm dev:api` / `pnpm dev:web` | Sobe apenas um dos apps |
| `pnpm build` | Build de produção de ambos os apps |
| `pnpm test` | Executa as suítes de teste de ambos os apps (Jest + Vitest) |
| `pnpm test:api` / `pnpm test:web` | Executa a suíte de apenas um app |
| `pnpm lint` | Lint de ambos os apps |
| `pnpm db:up` / `pnpm db:down` | Sobe/derruba o Postgres via Docker Compose |
| `pnpm prisma:generate` | Gera o Prisma Client (delega para `apps/api`) |
| `pnpm prisma:migrate` | Roda `prisma migrate dev` (delega para `apps/api`) |

## Testes

- `apps/api`: Jest (`@nestjs/testing`, convenção `*.spec.ts` para testes
  unitários e `*.e2e-spec.ts` para testes end-to-end). O script `pnpm test`
  (dentro de `apps/api`) roda a suíte unitária; `pnpm --filter ./apps/api
  test:e2e` roda a suíte e2e, que depende do Postgres local estar de pé
  (`pnpm db:up`) e das variáveis de `apps/api/.env` configuradas.
- `apps/web`: Vitest + Testing Library. O script `pnpm test` (dentro de
  `apps/web`) roda a suíte, incluindo o teste smoke de integração com o
  cliente HTTP da API (`tests/smoke.test.ts`).

## Variáveis de ambiente

Ver `.env.example` (raiz), `apps/api/.env.example` e `apps/web/.env.example`
para a lista completa de variáveis usadas em cada camada.

## Documentação da API

Com `apps/api` rodando, a documentação interativa (Swagger/OpenAPI) fica
disponível em `http://localhost:3000/docs`.

## Escopo desta versão do projeto

Este é o scaffolding inicial do monorepo (SPEC-00). Nenhuma funcionalidade
de negócio (autenticação, tickets, usuários, etc.) está implementada ainda —
isso é escopo das SPECs seguintes, documentadas em `specs/`.
