# SPEC-01: Modelagem de Dados

- **ID:** SPEC-01
- **Nome:** Modelagem de dados (Prisma schema do MVP de helpdesk)
- **Status:** APPROVED
- **Domain:** backend
- **Dependências:** SPEC-00 (setup inicial do projeto)

## 1. Objetivo

Definir e implementar, via Prisma dentro de `apps/api`, o modelo de dados
central do MVP de helpdesk: usuários (com papéis), tickets (com
categoria, SLA e anexos), comentários (com anexos), status e prioridades.
Gerar e aplicar a primeira migration real do projeto.

## 2. Contexto

Esta SPEC foi ajustada para a nova arquitetura de monorepo separado
(SPEC-00): o `schema.prisma` e todo o acesso ao banco de dados vivem
exclusivamente dentro de `apps/api`. **Não existe mais um `apps/web` com
acesso direto ao Prisma Client** — o frontend Next.js consome os dados
exclusivamente via HTTP contra a API NestJS. Isso não muda o modelo de
dados em si, apenas onde ele fisicamente vive e quem o acessa.

A SPEC-00 inicializou o Prisma em `apps/api` sem models de negócio. Após
revisão do usuário, o MVP de helpdesk foi **expandido** (CONFIRMED) além
do núcleo mínimo original (User/Role, Ticket/status/priority/assignee,
Comment) para incluir apenas o que está listado abaixo — recuperação de
senha **não** faz parte deste escopo expandido (ver seção 4, Fora do
Escopo):

- Um usuário pode ter um papel: `CUSTOMER` (abre tickets), `AGENT` (atende
  tickets), `ADMIN` (administra o sistema, inclui poderes de agente).
- Um ticket é aberto por um `CUSTOMER`, pode ser atribuído a um `AGENT`, tem
  status, prioridade e **categoria**.
- Um ticket tem **SLA formal**: prazo de atendimento (`dueAt`) derivado da
  prioridade, e um indicador de atraso (overdue).
- Um ticket tem comentários (histórico de conversa entre customer e agente).
- Tickets e comentários podem ter **anexos** (upload de arquivo).

## 3. Escopo

- Model `User`: id, name, email (único), emailVerified, image, password
  (nullable — hash de senha, usado pelo fluxo de autenticação da SPEC-02),
  role (`Role` enum), timestamps, relações (tickets criados, tickets
  atribuídos, comentários, anexos enviados).
- Enum `Role`: `CUSTOMER`, `AGENT`, `ADMIN`.
- Model `Ticket`: id, title, description, status (`TicketStatus` enum),
  priority (`TicketPriority` enum), category (`TicketCategory` enum),
  createdBy (relação com `User`), assignedTo (relação opcional com
  `User`), `dueAt` (SLA — DateTime, calculado na criação e recalculado se
  a prioridade mudar), timestamps (createdAt, updatedAt, closedAt
  nullable), anexos.
- Enum `TicketStatus`: `OPEN`, `IN_PROGRESS`, `WAITING_CUSTOMER`,
  `RESOLVED`, `CLOSED`.
- Enum `TicketPriority`: `LOW`, `MEDIUM`, `HIGH`, `URGENT`.
- Enum `TicketCategory`: `GENERAL`, `TECHNICAL`, `BILLING`, `ACCOUNT`,
  `FEATURE_REQUEST`, `OTHER` (lista inicial enxuta — INFERRED, ajustável
  pelo usuário na aprovação; ver seção 9).
- Model `Comment`: id, content, ticketId (relação com `Ticket`), authorId
  (relação com `User`), timestamps, anexos.
- Model `Attachment` (novo — anexos de arquivo): id, filename (nome
  original), mimeType, size (bytes), storageKey (caminho/chave no
  storage, ver seção 3.1), ticketId (opcional, relação com `Ticket`),
  commentId (opcional, relação com `Comment`), uploadedById (relação com
  `User`), createdAt. Exatamente um entre `ticketId`/`commentId` deve
  estar preenchido (anexo pertence ao ticket diretamente OU a um
  comentário do ticket, nunca a nenhum ou aos dois) — regra aplicada na
  camada de serviço (SPEC-03/04), não como constraint SQL nesta SPEC.
- Índices relevantes: `Ticket.status`, `Ticket.assignedToId`,
  `Ticket.createdById`, `Ticket.category`, `Ticket.dueAt`,
  `Comment.ticketId`, `Attachment.ticketId`, `Attachment.commentId`.
- Migration inicial (`prisma migrate dev`) gerada e commitada em
  `apps/api/prisma/migrations/`.
- Seed script (`apps/api/prisma/seed.ts`) opcional com dados mínimos de
  exemplo (1 admin, 1 agent, 1 customer, 1 ticket) para facilitar
  desenvolvimento local — não obrigatório para produção.

### 3.1 SLA e overdue (abordagem escolhida)

- `Ticket.dueAt` é uma coluna persistida, calculada no momento da criação
  do ticket (e recalculada se a prioridade mudar via `PATCH`, SPEC-03) a
  partir de uma tabela de prazos por prioridade (constante de aplicação,
  não tabela de banco, para manter o MVP simples):

  | Prioridade | Prazo (SLA) |
  |---|---|
  | URGENT | 4 horas |
  | HIGH | 8 horas |
  | MEDIUM | 24 horas |
  | LOW | 72 horas |

  (Valores INFERRED, ajustáveis pelo usuário na aprovação — ver seção 9.
  Não considera calendário útil/horário comercial no MVP, apenas horas
  corridas a partir de `createdAt`.)

- **"Overdue" é um valor derivado, não uma coluna persistida**: um ticket
  está atrasado quando `dueAt < now()` **e** `status` não é `RESOLVED`
  nem `CLOSED`. Isso evita um flag que fica desatualizado sem um job de
  background rodando; a API (SPEC-03) calcula e expõe `overdue: boolean`
  em cada resposta de ticket a partir de `dueAt` e `status` no momento da
  consulta. Quando o ticket é resolvido/fechado, `dueAt` fica congelado
  (não é mais recalculado) e `overdue` passa a refletir se foi resolvido
  dentro do prazo (`closedAt <= dueAt`) — útil para métricas futuras, fora
  do escopo desta SPEC.

### 3.2 Anexos e storage (abordagem escolhida)

Decisão de arquitetura para persistência dos arquivos em si (não dos
metadados, que ficam no Postgres via `Attachment`):

- Abstração `StorageService` (interface única, em `apps/api/src/storage/`)
  com os métodos `upload(file) -> storageKey`, `getUrl(storageKey) ->
  string` e `delete(storageKey) -> void`, implementada por driver
  configurável via env (`STORAGE_DRIVER=local|blob`):
  - **Dev (`local`, default):** disco local do container/máquina de
    desenvolvimento, em `apps/api/uploads/` (fora do controle de versão),
    servido por um endpoint autenticado do próprio Nest (não estático
    público — respeita as mesmas regras de visibilidade do ticket/
    comentário pai, aplicadas pela SPEC-03/04).
  - **Prod (`blob`):** um provedor de object storage compatível (ex.:
    Vercel Blob, ou S3/R2 equivalente) por trás da mesma interface —
    escolha concreta do provedor é decisão de infraestrutura no momento
    do deploy, não desta SPEC; o único requisito arquitetural aqui é que
    a troca de driver não exija mudar nenhum código de negócio
    (controllers/services de ticket/comentário), apenas a implementação
    do `StorageService` e a env `STORAGE_DRIVER`.
- Limites básicos (INFERRED, ajustáveis): tamanho máximo por arquivo 10MB,
  tipos permitidos restritos a uma lista razoável (imagens, PDF, texto,
  documentos office) — validados no upload (SPEC-03/04), não nesta SPEC
  de modelagem.
- Esta SPEC-01 só define o model `Attachment` (metadados). A
  implementação do `StorageService`, dos endpoints de upload e das
  validações de tamanho/tipo é escopo da SPEC-03 (anexos em ticket) e
  SPEC-04 (anexos em comentário).

### Nota sobre tabelas do Auth.js adapter (Account/Session/VerificationToken) — RESOLVIDO

A SPEC-02 confirmou JWT emitido pelo NestJS (sem Auth.js/NextAuth em
nenhuma camada). Portanto as tabelas `Account`, `Session` e
`VerificationToken` do Auth.js adapter **não existem** neste schema.
Sessão é stateless (JWT em cookie httpOnly). Não há mais
`[NEEDS_DECISION]` associado a este ponto.

## 4. Fora do Escopo

- Endpoints de API (controllers/services NestJS) para manipular esses
  models, incluindo upload/download de anexos — SPEC-03 e SPEC-04.
- Lógica de autorização por papel (guards, decorators) — SPEC-02.
- Qualquer código em `apps/web` — o frontend não acessa o Prisma Client
  nem o banco diretamente, apenas consome a API via HTTP.
- Escolha concreta do provedor de object storage em produção (Vercel
  Blob vs. S3/R2 vs. outro) — decisão de infraestrutura no momento do
  deploy, fora do escopo desta SPEC (que só define a interface
  `StorageService` e o driver local de dev).
- Cálculo de SLA considerando calendário útil/horário comercial — fora do
  MVP (horas corridas apenas).
- Departamentos/times de suporte (diferente de categoria de ticket) —
  fora do MVP.
- **Recuperação de senha** (fluxo "esqueci minha senha", model
  `PasswordResetToken`, envio de email) — fora do escopo do MVP.
  Explicitamente descartado pelo usuário; não há model de reset de senha
  neste schema nem em nenhuma outra SPEC.

## 5. Requisitos Funcionais

Não aplicável diretamente (SPEC de modelagem) — os requisitos funcionais
reais serão exercidos pelas SPECs de API (03, 04).

## 6. Requisitos Não Funcionais

- Schema deve ser válido (`prisma validate` sem erros), localizado em
  `apps/api/prisma/schema.prisma`.
- Migration deve aplicar limpo em um Postgres vazio (`prisma migrate dev`
  do zero), executada a partir de `apps/api`.
- Enums modelados como enum nativo do Postgres via Prisma (não strings
  livres).
- Regra de integridade: um `Ticket` sempre tem `createdById` obrigatório;
  `assignedToId` é opcional (nullable) até que um agente seja atribuído.
- Nenhum outro pacote do monorepo (`apps/web`) declara dependência do
  `@prisma/client` ou tem acesso direto ao `DATABASE_URL`.

## 7. Modelo de Dados (resumo Prisma)

\`\`\`prisma
enum Role {
  CUSTOMER
  AGENT
  ADMIN
}

enum TicketStatus {
  OPEN
  IN_PROGRESS
  WAITING_CUSTOMER
  RESOLVED
  CLOSED
}

enum TicketPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum TicketCategory {
  GENERAL
  TECHNICAL
  BILLING
  ACCOUNT
  FEATURE_REQUEST
  OTHER
}

model User {
  id               String       @id @default(cuid())
  name             String?
  email            String       @unique
  emailVerified    DateTime?
  image            String?
  password         String?
  role             Role         @default(CUSTOMER)
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  ticketsCreated   Ticket[]     @relation("TicketCreatedBy")
  ticketsAssigned  Ticket[]     @relation("TicketAssignedTo")
  comments         Comment[]
  attachments      Attachment[]
}

model Ticket {
  id           String         @id @default(cuid())
  title        String
  description  String
  status       TicketStatus   @default(OPEN)
  priority     TicketPriority @default(MEDIUM)
  category     TicketCategory @default(GENERAL)
  createdById  String
  createdBy    User           @relation("TicketCreatedBy", fields: [createdById], references: [id])
  assignedToId String?
  assignedTo   User?          @relation("TicketAssignedTo", fields: [assignedToId], references: [id])
  comments     Comment[]
  attachments  Attachment[]
  dueAt        DateTime?
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  closedAt     DateTime?

  @@index([status])
  @@index([assignedToId])
  @@index([createdById])
  @@index([category])
  @@index([dueAt])
}

model Comment {
  id          String       @id @default(cuid())
  content     String
  ticketId    String
  ticket      Ticket       @relation(fields: [ticketId], references: [id])
  authorId    String
  author      User         @relation(fields: [authorId], references: [id])
  attachments Attachment[]
  createdAt   DateTime     @default(now())

  @@index([ticketId])
}

model Attachment {
  id           String   @id @default(cuid())
  filename     String
  mimeType     String
  size         Int
  storageKey   String
  ticketId     String?
  ticket       Ticket?  @relation(fields: [ticketId], references: [id])
  commentId    String?
  comment      Comment? @relation(fields: [commentId], references: [id])
  uploadedById String
  uploadedBy   User     @relation(fields: [uploadedById], references: [id])
  createdAt    DateTime @default(now())

  @@index([ticketId])
  @@index([commentId])
}
\`\`\`

Localização: `apps/api/prisma/schema.prisma`.

Models `Account`, `Session`, `VerificationToken` do Auth.js Prisma Adapter
**não estão incluídos** neste schema — confirmado pela decisão da SPEC-02
(JWT emitido pelo Nest, sem Auth.js).

## 8. Dependências de Outras SPECs

- SPEC-00 (setup inicial, Prisma inicializado em `apps/api`, Postgres
  local disponível, `STORAGE_DRIVER` documentado no `.env.example` de
  `apps/api`).
- Decisão de autenticação da SPEC-02 (JWT, confirmada — sem tabelas de
  adapter).

## 9. Decisões Confirmadas (CONFIRMED)

O MVP foi expandido pelo usuário para incluir, além do núcleo original
(User/Role, Ticket com status/priority/assignee, Comment): categoria de
ticket, SLA formal (dueAt + overdue derivado), anexos (em ticket e/ou
comentário) com storage local em dev e um provedor de object storage
compatível (ex. Vercel Blob/S3) em produção via interface
`StorageService` comum — tudo detalhado nas seções 3, 3.1 e 3.2.
Recuperação de senha **não** faz parte deste escopo expandido (ver seção
4, Fora do Escopo) — não há model de reset de senha neste schema.

Os valores específicos assumidos como INFERRED (lista de categorias da
seção 3, prazos de SLA por prioridade da seção 3.1, limites de upload da
seção 3.2) ficam sujeitos a ajuste fino do usuário no momento da
aprovação desta SPEC, mas não bloqueiam a aprovação — são defaults
razoáveis e de baixo custo para alterar depois via nova migration/config.

Não há mais `[NEEDS_DECISION]` nesta SPEC.

## 10. Critérios de Aceitação

- [ ] `apps/api/prisma/schema.prisma` contém os models/enums da seção 7,
      incluindo `TicketCategory`, `Ticket.dueAt` e o model `Attachment`.
- [ ] `pnpm prisma:migrate` (a partir da raiz ou de `apps/api`) gera e
      aplica migration inicial sem erro em Postgres local limpo.
- [ ] `pnpm prisma:generate` gera o Prisma Client sem erro, dentro de
      `apps/api` (não em `apps/web`).
- [ ] Testes (Jest, conforme SPEC-00) cobrindo ao menos: criação de um
      `User`, criação de um `Ticket` vinculado a um `User` com `category`
      e `dueAt`, criação de um `Comment` vinculado a um `Ticket`, criação
      de um `Attachment` vinculado a um `Ticket` e a um `Comment`
      separadamente, validando integridade referencial (via banco de
      teste local ou Prisma Client mockado, a critério do dev-backend,
      desde que documentado).
- [ ] Seed script (se implementado) roda sem erro via `pnpm prisma db seed`
      dentro de `apps/api`.
- [ ] `apps/web/package.json` não declara `@prisma/client` como
      dependência.

## 11. Definition of Done

- Critérios de aceitação da seção 10 atendidos.
- Testes implementados e passando (Jest).
- Migration commitada em `apps/api/prisma/migrations/`.
- Nenhum endpoint de API (controller/service) criado nesta SPEC —
  inclusive nenhum endpoint de upload/download de anexo (SPEC-03/04).
- Nenhuma implementação concreta do `StorageService` (driver local ou
  blob) criada nesta SPEC — apenas o model `Attachment` (metadados). A
  interface e os drivers são escopo da SPEC-03/04.

## 12. Riscos

- Mudança de modelo de dados após esta SPEC ser implementada exige nova
  migration e pode impactar SPECs subsequentes já implementadas.
- Regra "exatamente um entre ticketId/commentId em Attachment" não é uma
  constraint de banco nesta SPEC (aplicada só na camada de serviço da
  SPEC-03/04) — risco de inconsistência se um endpoint futuro escrever
  direto no Prisma sem passar pelo serviço; mitigar mantendo toda escrita
  de `Attachment` centralizada em um único serviço.
- Prazos de SLA fixos em horas corridas (seção 3.1) podem não refletir
  necessidades reais de horário comercial — aceito como simplificação do
  MVP, revisável em SPEC futura se necessário.
