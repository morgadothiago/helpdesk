# SPEC-04: API de Comentários em Tickets

- **ID:** SPEC-04
- **Nome:** API de comentários em tickets
- **Status:** APPROVED
- **Domain:** backend
- **Dependências:** SPEC-03 (API de tickets CRUD)


## 1. Objetivo

Implementar os endpoints para adicionar e listar comentários (histórico de
conversa, incluindo anexos) em um ticket, respeitando as mesmas regras de
visibilidade por papel já estabelecidas para tickets.

## 2. Contexto

Complementa a SPEC-03: um ticket sem comentários não permite comunicação
entre customer e agente. Reaproveita os models `Comment`/`Attachment` da
SPEC-01 e os guards de autorização da SPEC-02.

**Correção de arquitetura:** como na SPEC-03, esta versão substitui as
referências a "route handlers do Next.js App Router" por controllers
NestJS em `apps/api`, sem prefixo `/api` nos caminhos (mesma convenção da
SPEC-03).

## 3. Escopo

Endpoints (`apps/api/src/comments/comments.controller.ts`, aninhado sob
tickets, protegidos por `JwtAuthGuard`):

- `POST /tickets/:id/comments` — cria comentário no ticket `:id`. Aceita
  `multipart/form-data` com `content` (texto) e, opcionalmente, um ou
  mais arquivos (`files[]`) anexados ao comentário criado, reaproveitando
  o `StorageService`/model `Attachment` da SPEC-01 (mesmos limites de
  tamanho/tipo definidos na SPEC-01 seção 3.2 e aplicados também pela
  SPEC-03). Requisição sem arquivos continua funcionando normalmente
  (campo de arquivos é opcional).
  - `CUSTOMER`: só pode comentar em ticket próprio, e só se o ticket não
    estiver `CLOSED`.
  - `AGENT`/`ADMIN`: pode comentar em qualquer ticket, exceto `CLOSED`
    (mesma regra).
  - `authorId` sempre vem da sessão.
  - Comentar em um ticket **nunca altera `Ticket.status`** (decisão
    resolvida na seção 9: opção manual). O `CommentsService` não escreve
    em `Ticket.status` em nenhuma circunstância — a única forma de mudar
    o status de um ticket é a chamada explícita a `PATCH /tickets/:id`
    (SPEC-03), sujeita à máquina de estados restrita definida lá (seção
    9 da SPEC-03). Criar um comentário é um efeito isolado: persiste o
    `Comment` (e seus anexos, se houver) e nada mais.
- `GET /tickets/:id/comments` — lista comentários do ticket, ordenados
  por `createdAt asc`, incluindo os anexos de cada comentário (metadados +
  URL de download), com a mesma regra de visibilidade de ticket da
  SPEC-03 (404 se `CUSTOMER` não for dono).
- `GET /tickets/:id/comments/:commentId/attachments/:attachmentId/download`
  — download autenticado do anexo de um comentário, mesma regra de
  visibilidade (reaproveita o padrão do endpoint equivalente de anexo de
  ticket da SPEC-03).
- Validação de payload com `zod` (`content` não vazio, tamanho máximo
  razoável, ex. 5000 caracteres; arquivos validados conforme SPEC-01
  seção 3.2).

## 4. Fora do Escopo

- Edição/exclusão de comentários — fora do MVP (comentários são
  imutáveis, como um log de conversa). Anexos de um comentário herdam
  essa imutabilidade (não é possível adicionar/remover anexo depois de
  criado o comentário).
- Notificação em tempo real (websocket/polling) de novos comentários —
  fora do MVP; frontend fará fetch sob demanda.

## 5. Requisitos Funcionais

- RF01: `POST /tickets/:id/comments` sem sessão retorna 401.
- RF02: `POST` em ticket alheio como `CUSTOMER` retorna 404.
- RF03: `POST` em ticket com `status: CLOSED` retorna 400/409 (ticket
  encerrado não aceita novos comentários).
- RF04: `GET /tickets/:id/comments` retorna lista ordenada
  cronologicamente, incluindo nome/role do autor de cada comentário e
  seus anexos (se houver).
- RF05: `content` vazio ou ausente retorna 400.
- RF06: `POST /tickets/:id/comments` com arquivo acima do limite de
  tamanho ou tipo não permitido (SPEC-01 seção 3.2) retorna 400 e não
  cria o comentário nem os demais anexos do mesmo request (tudo ou nada).
- RF07: `GET /tickets/:id/comments/:commentId/attachments/:attachmentId/download`
  de anexo de ticket de outro `CUSTOMER` retorna 404.
- RF08: `AGENT` comenta em ticket `IN_PROGRESS` → `Ticket.status`
  permanece `IN_PROGRESS` (comentar nunca muda o status).
- RF09: `CUSTOMER` comenta em ticket `WAITING_CUSTOMER` → `Ticket.status`
  permanece `WAITING_CUSTOMER` (comentar nunca muda o status; mudança de
  status só ocorre via `PATCH /tickets/:id` explícito, SPEC-03).

## 6. Requisitos Não Funcionais

- Reaproveita as mesmas checagens de visibilidade de ticket da SPEC-03 (sem
  duplicar lógica — extrair helper compartilhado se necessário, ex.
  `getTicketVisibleToUser`).
- `CommentsService` nunca escreve em `Ticket.status` nem chama nenhum
  método de transição de status do `TicketsService` — criar comentário e
  mudar status são operações completamente independentes.

## 7. Contrato de API (resumo)

```
POST /tickets/:id/comments                                              multipart/form-data: content, files[]?
GET  /tickets/:id/comments
GET  /tickets/:id/comments/:commentId/attachments/:attachmentId/download
```

## 8. Dependências de Outras SPECs

- SPEC-01 (models `Comment`, `Attachment`, `StorageService`).
- SPEC-02 (autorização — `JwtAuthGuard`/`RolesGuard`).
- SPEC-03 (regras de visibilidade de ticket e padrão de download de
  anexo, reaproveitados aqui).

## 9. Decisão de Mudança de Status ao Comentar (CONFIRMED)

**Confirmado: opção manual — comentar nunca muda o status.**

- Criar um comentário (`POST /tickets/:id/comments`) é uma operação
  isolada: persiste o `Comment` (e anexos, se houver) e não escreve em
  `Ticket.status` em nenhuma circunstância, independentemente do papel de
  quem comenta ou do status atual do ticket.
- A única forma de mudar `Ticket.status` é a chamada explícita a `PATCH
  /tickets/:id` (SPEC-03), sujeita à máquina de estados restrita da
  SPEC-03 seção 9 (mapa de transições válidas).
- `CommentsService` não tem nenhum efeito colateral automático sobre
  status — não chama, direta ou indiretamente, nenhum método de escrita
  de `Ticket.status` do `TicketsService`.
- Esta decisão simplifica o modelo mental: o histórico de conversa
  (comentários) e o estado do fluxo de atendimento (status) são
  controlados por ações distintas e explícitas do usuário.

## 10. Critérios de Aceitação

- [ ] Todos os RFs da seção 5 cobertos por teste Jest.
- [ ] Comentário sempre inclui dados mínimos do autor (nome, role) e seus
      anexos na resposta de `GET`, sem expor dados sensíveis
      (senha/hash).
- [ ] Regra de bloqueio de comentário em ticket `CLOSED` coberta por
      teste.
- [ ] Upload de anexo em comentário valida tamanho/tipo e é atômico
      (tudo ou nada) com a criação do comentário.
- [ ] Ausência de mudança automática de status ao comentar (seção 9)
      coberta por teste: AGENT/ADMIN comentando em ticket `IN_PROGRESS`
      mantém `IN_PROGRESS`; CUSTOMER comentando em ticket
      `WAITING_CUSTOMER` mantém `WAITING_CUSTOMER`.

## 11. Definition of Done

- Critérios de aceitação atendidos.
- Testes Jest passando.
- Nenhuma tela implementada.
- `CommentsService` não contém nenhuma lógica de escrita ou transição de
  `Ticket.status` (seção 9) — mudança de status é responsabilidade
  exclusiva do `PATCH /tickets/:id` da SPEC-03.

## 12. Riscos

- Nenhum risco de acoplamento entre `CommentsService` e a escrita de
  `Ticket.status`, já que esta SPEC não implementa nenhum efeito
  colateral automático — as duas responsabilidades permanecem
  completamente desacopladas.
