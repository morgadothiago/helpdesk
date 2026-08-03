# SPEC-03: API de Tickets (CRUD)

- **ID:** SPEC-03
- **Nome:** API de tickets — criação, listagem, detalhe, atualização
- **Status:** IMPLEMENTED
- **Domain:** backend
- **Dependências:** SPEC-01 (modelagem de dados), SPEC-02 (autenticação e autorização)

## 1. Objetivo

Implementar os endpoints REST (controllers/services NestJS em
`apps/api`) que permitem criar, listar, visualizar e atualizar tickets —
incluindo categoria, SLA (dueAt/overdue) e anexos —, respeitando as
regras de autorização por papel definidas na SPEC-02.

## 2. Contexto

Com o modelo de dados (SPEC-01, incluindo `TicketCategory`, `dueAt` e
`Attachment`) e a autenticação/autorização (SPEC-02) prontos, esta SPEC
implementa a camada de API de tickets, que será consumida pelas telas das
SPEC-06, 07 e 08.

**Correção de arquitetura:** versões anteriores desta SPEC referenciavam
"route handlers do Next.js App Router" (`src/app/api/tickets/**/route.ts`)
— isso é resíduo da arquitetura anterior (Next.js full-stack), já
substituída pela SPEC-00/02 (backend NestJS separado, sem rotas de
negócio no Next.js). Esta versão corrige isso: os endpoints abaixo são
controllers NestJS em `apps/api/src/tickets/`, documentados no Swagger, e
`apps/web` apenas os consome via HTTP. Os caminhos não usam prefixo
`/api` (mesma convenção de `GET /health` e `/auth/**` da SPEC-00/02): a
base é `NEXT_PUBLIC_API_URL` + `/tickets`, não
`NEXT_PUBLIC_API_URL/api/tickets`.

## 3. Escopo

Endpoints (`apps/api/src/tickets/tickets.controller.ts`, protegidos por
`JwtAuthGuard`):

- `POST /tickets` — cria ticket. Autenticado como `CUSTOMER` (ou
  `AGENT`/`ADMIN` criando em nome de si mesmo). `createdById` sempre vem da
  sessão, nunca do body. Status inicial sempre `OPEN`. Body aceita
  `category` (opcional, default `GENERAL`). `dueAt` é calculado
  automaticamente no service a partir de `priority` (tabela de prazos da
  SPEC-01 seção 3.1), nunca recebido do client.
- `GET /tickets` — lista tickets com filtros e paginação:
  - `CUSTOMER`: retorna apenas tickets onde `createdById === session.user.id`.
  - `AGENT`/`ADMIN`: retorna todos os tickets, com filtros opcionais via
    query string: `status`, `priority`, `category`, `assignedToId`
    (incluindo valor especial `unassigned`), `overdue` (boolean —
    calculado em memória/query conforme regra da SPEC-01 seção 3.1, não é
    coluna filtrável diretamente).
  - Paginação via `page`/`pageSize` (defaults razoáveis, ex. 20).
  - Ordenação padrão: `createdAt desc`.
  - Cada ticket na resposta inclui `dueAt` e `overdue` (derivado no
    momento da resposta, conforme SPEC-01 seção 3.1).
- `GET /tickets/:id` — detalhe do ticket. `CUSTOMER` só pode ver o
  próprio; `AGENT`/`ADMIN` podem ver qualquer um. 404 (não 403) se o
  `CUSTOMER` tentar acessar ticket de outro usuário (evita vazar
  existência). Resposta inclui `category`, `dueAt`, `overdue` e lista de
  anexos (`attachments`, metadados + URL de download).
- `PATCH /tickets/:id` — atualização parcial:
  - `CUSTOMER`: pode apenas atualizar `title`/`description` do próprio
    ticket, e apenas enquanto `status === 'OPEN'`.
  - `AGENT`/`ADMIN`: pode atualizar `status`, `priority`, `category`,
    `assignedToId`.
  - Mudar `priority` recalcula `dueAt` a partir de `createdAt` (não do
    momento da mudança), conforme SPEC-01 seção 3.1.
  - Transição para `status: CLOSED` ou `RESOLVED` seta `closedAt`
    automaticamente (e congela `dueAt`, conforme SPEC-01 seção 3.1);
    reabrir (voltar para `OPEN`/`IN_PROGRESS`) limpa `closedAt`.
  - Máquina de estados restrita (decisão da seção 9): `status` só pode
    mudar conforme o mapa de transições válidas da seção 9. Uma
    transição fora do mapa retorna 400/409, mesmo que o papel tenha
    permissão para alterar `status`. Reabertura explícita
    (`RESOLVED`/`CLOSED` → `OPEN`/`IN_PROGRESS`) é a única exceção ao
    fluxo linear.
- `POST /tickets/:id/attachments` — upload de arquivo (`multipart/form-
  data`) anexado diretamente ao ticket (não a um comentário). Usa o
  `StorageService` da SPEC-01 seção 3.2. Mesma regra de visibilidade do
  ticket (`CUSTOMER` só no próprio, 404 senão). Valida tamanho/tipo
  (limites da SPEC-01 seção 3.2, ex. 10MB, lista de mimetypes permitida).
  Bloqueado se `status === 'CLOSED'` (mesma lógica de "ticket encerrado
  não recebe novo conteúdo" aplicada a comentários na SPEC-04).
- `GET /tickets/:id/attachments` — lista anexos do ticket (metadados +
  URL de download via `StorageService.getUrl`), mesma regra de
  visibilidade do ticket.
- `GET /tickets/:id/attachments/:attachmentId/download` — stream/redirect
  do arquivo em si (via `StorageService`), autenticado e respeitando a
  mesma visibilidade — necessário porque o driver `local` (SPEC-01) não
  expõe os arquivos publicamente.
- Validação de payload com `zod` em todos os endpoints.
- Tratamento de erros padronizado (400 validação, 401 não autenticado, 403
  não autorizado, 404 não encontrado, 500 erro interno) com formato JSON
  consistente `{ error: { code, message } }`.

## 4. Fora do Escopo

- Comentários em tickets (e anexos em comentários) — SPEC-04.
- Exclusão definitiva (`DELETE`) de tickets ou de anexos — fora do MVP;
  "encerrar" é feito via `status: CLOSED`, não deleção física.
- Qualquer tela — SPECs 06, 07, 08.
- Notificações (email, push) sobre mudanças de ticket ou SLA vencendo —
  fora do MVP (overdue é só exibido, não gera alerta ativo).
- Escolha do provedor de object storage em produção — SPEC-01 seção 3.2
  (decisão de infraestrutura, não desta SPEC).

## 5. Requisitos Funcionais

- RF01: `POST /tickets` sem sessão retorna 401.
- RF02: `POST /tickets` com payload inválido (ex. `title` vazio)
  retorna 400 com detalhes do erro de validação.
- RF03: `GET /tickets` como `CUSTOMER` nunca retorna tickets de outro
  usuário.
- RF04: `GET /tickets` como `AGENT` aceita filtro `status=OPEN` e
  retorna apenas tickets com esse status.
- RF05: `PATCH /tickets/:id` como `CUSTOMER` tentando mudar `status`
  retorna 403 (campo não permitido para o papel).
- RF06: `PATCH /tickets/:id` como `AGENT` mudando `status` para
  `RESOLVED` seta `closedAt`.
- RF13: `PATCH /tickets/:id` como `AGENT` tentando mudar `status` de
  `OPEN` diretamente para `CLOSED` (pulando etapas) retorna 400/409.
- RF14: `PATCH /tickets/:id` como `AGENT` mudando `status` de `RESOLVED`
  para `OPEN` (reabertura explícita) é aceito.
- RF07: `GET /tickets/:id` de ticket de outro `CUSTOMER` retorna 404.
- RF08: `POST /tickets` sem `category` no body usa `GENERAL` como default;
  `dueAt` retornado é coerente com a prioridade (tabela da SPEC-01 seção
  3.1).
- RF09: `GET /tickets/:id` de um ticket com `dueAt` no passado e
  `status: OPEN` retorna `overdue: true`; o mesmo ticket com
  `status: RESOLVED` retorna `overdue` calculado a partir de
  `closedAt <= dueAt`.
- RF10: `POST /tickets/:id/attachments` com arquivo acima do limite de
  tamanho retorna 400; com tipo não permitido retorna 400.
- RF11: `POST /tickets/:id/attachments` em ticket `CLOSED` retorna
  400/409.
- RF12: `GET /tickets/:id/attachments/:attachmentId/download` de anexo de
  ticket de outro `CUSTOMER` retorna 404.

## 6. Requisitos Não Funcionais

- Todas as rotas usam os helpers `requireAuth`/`requireRole` da SPEC-02.
- Nenhuma query Prisma monta filtro de autorização "opcionalmente" — a
  restrição por papel é sempre aplicada na cláusula `where`, nunca só
  filtrada em memória depois.
- A validação da máquina de estados (seção 9) vive em um único ponto do
  `TicketsService` (ex. método `assertValidTransition(from, to)`),
  reaproveitado por qualquer caminho que escreva `Ticket.status`
  (incluindo o gatilho da SPEC-04), para evitar duas fontes de verdade.
- Respostas de erro nunca vazam detalhes internos (stack trace) em
  produção.

## 7. Contrato de API (resumo)

```
POST   /tickets                                    body: { title, description, priority?, category? }
GET    /tickets                                     query: page, pageSize, status?, priority?, category?, assignedToId?, overdue?
GET    /tickets/:id
PATCH  /tickets/:id                                 body: partial { title?, description?, status?, priority?, category?, assignedToId? }
POST   /tickets/:id/attachments                     multipart/form-data: file
GET    /tickets/:id/attachments
GET    /tickets/:id/attachments/:attachmentId/download
```

## 8. Dependências de Outras SPECs

- SPEC-01 (models `Ticket`, `User`, `Attachment`, enums, `StorageService`).
- SPEC-02 (`JwtAuthGuard`, `RolesGuard`, sessão com `role`).

## 9. Decisão de Transições de Status (CONFIRMED)

**Confirmado: máquina de estados restrita.** `PATCH /tickets/:id` só
aceita uma mudança de `status` se ela constar no mapa de transições
válidas abaixo, respeitando ainda as regras de papel já definidas na
seção 3 (as duas checagens se aplicam: papel autorizado a alterar
`status` **e** transição presente no mapa). Fora do mapa, a API retorna
400/409, mesmo que o papel tenha permissão geral para alterar `status`.

**Mapa de transições válidas:**

| De | Para | Observação |
|---|---|---|
| `OPEN` | `IN_PROGRESS` | fluxo normal — agente assume o ticket |
| `IN_PROGRESS` | `WAITING_CUSTOMER` | agente aguarda resposta do cliente |
| `IN_PROGRESS` | `RESOLVED` | agente resolve sem precisar de resposta do cliente |
| `WAITING_CUSTOMER` | `IN_PROGRESS` | cliente respondeu, volta para o agente |
| `WAITING_CUSTOMER` | `RESOLVED` | agente resolve após resposta do cliente |
| `RESOLVED` | `CLOSED` | encerramento definitivo |
| `RESOLVED` | `OPEN` | **reabertura explícita** (exceção ao fluxo linear) |
| `RESOLVED` | `IN_PROGRESS` | **reabertura explícita** (exceção ao fluxo linear) |
| `CLOSED` | `OPEN` | **reabertura explícita** (exceção ao fluxo linear) |
| `CLOSED` | `IN_PROGRESS` | **reabertura explícita** (exceção ao fluxo linear) |

Qualquer transição não listada (ex. `OPEN → CLOSED` direto, `OPEN →
RESOLVED` direto, `OPEN → WAITING_CUSTOMER` direto, `CLOSED →
WAITING_CUSTOMER`, `CLOSED → RESOLVED`) é rejeitada com 400/409. Não há
pular etapas no fluxo linear (`OPEN → IN_PROGRESS → WAITING_CUSTOMER →
RESOLVED → CLOSED`); a única exceção deliberada é a reabertura explícita
de `RESOLVED`/`CLOSED` de volta para `OPEN`/`IN_PROGRESS`.

Reabrir (qualquer transição de volta para `OPEN`/`IN_PROGRESS`) limpa
`closedAt`, conforme já descrito na seção 3.

Não há mais `[NEEDS_DECISION]` nesta SPEC.

## 10. Critérios de Aceitação

- [ ] Todos os RFs da seção 5 cobertos por teste Jest (com Prisma
      mockado ou banco de teste, a critério do dev-backend, documentado no
      README de testes).
- [ ] Validação `zod` rejeita payloads inválidos em todos os endpoints.
- [ ] Filtros e paginação de `GET /tickets` (incluindo `category` e
      `overdue`) funcionam conforme especificado.
- [ ] `dueAt`/`overdue` corretos conforme SPEC-01 seção 3.1, cobertos por
      teste (incluindo recálculo ao mudar prioridade e congelamento ao
      resolver/fechar).
- [ ] Upload de anexo (`POST /tickets/:id/attachments`) valida tamanho e
      tipo, respeita visibilidade do ticket e bloqueia ticket `CLOSED`.
- [ ] Regras de autorização por papel cobertas por teste para os 3 papéis.
- [ ] Máquina de estados (seção 9) coberta por teste: cada transição do
      mapa é aceita; ao menos uma transição fora do mapa (ex. `OPEN` →
      `CLOSED` direto) é rejeitada com 400/409.

## 11. Definition of Done

- Critérios de aceitação atendidos.
- Testes Jest passando (unitários e/ou de integração dos controllers/
  services).
- Nenhuma tela implementada.
- Máquina de estados restrita (seção 9) implementada conforme o mapa de
  transições válidas, centralizada em um único método do
  `TicketsService`.

## 12. Riscos

- Máquina de estados restrita pode bloquear um caso de uso legítimo não
  previsto no mapa da seção 9 (ex. um atalho que a operação real do
  suporte queira usar) — mitigar revisando o mapa em SPEC futura se o
  uso real do sistema mostrar necessidade de novas transições.
