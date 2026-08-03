# SPEC-06: Telas de Criação e Listagem de Tickets (Cliente)

- **ID:** SPEC-06
- **Nome:** Telas de criação e listagem de tickets para o customer
- **Status:** APPROVED
- **Domain:** frontend
- **Dependências:** SPEC-03 (API de tickets CRUD), SPEC-05 (telas de autenticação)

## 1. Objetivo

Implementar a interface para que um usuário `CUSTOMER` crie novos tickets e
visualize a lista dos próprios tickets com filtros básicos.

## 2. Contexto

Com a API de tickets (SPEC-03) e a autenticação de UI (SPEC-05) prontas,
esta SPEC entrega a primeira tela de valor do produto do ponto de vista do
cliente final do helpdesk.

## 3. Escopo

- Página `/tickets` (`src/app/tickets/page.tsx`):
  - Lista os tickets do `CUSTOMER` logado (consumindo `GET /tickets` da
    API Nest).
  - Exibe título, status (badge colorido por status), prioridade,
    categoria (badge), prazo de SLA (`dueAt`, formatado) com indicador
    visual de atraso quando `overdue: true`, data de criação, em formato
    de tabela/lista (shadcn `Table` ou `Card`s).
  - Filtro por `status` e por `category` (selects).
  - Paginação (se houver mais itens que `pageSize`).
  - Estado vazio ("Você ainda não abriu nenhum ticket") com CTA para criar.
  - Link para cada ticket abrindo o detalhe (SPEC-07).
- Página `/tickets/novo` (`src/app/tickets/novo/page.tsx`):
  - Formulário de criação: `title`, `description`, `priority` (select,
    default `MEDIUM`), `category` (select, default `GENERAL`), e anexo
    de arquivo opcional (input de upload — enviado via
    `POST /tickets/:id/attachments` logo após a criação do ticket, ou em
    uma segunda etapa; detalhe de sequenciamento a critério do
    dev-frontend, desde que documentado).
  - Validação client-side (campos obrigatórios) espelhando a validação
    `zod` do backend.
  - Submissão via `POST /tickets`; sucesso redireciona para o detalhe
    do ticket criado (SPEC-07) ou para `/tickets` com toast de sucesso.
  - Estado de loading/erro no submit.

## 4. Fora do Escopo

- Visualização/edição de comentários — SPEC-07.
- Painel do agente (lista de todos os tickets, atribuição) — SPEC-08.
- Edição de ticket já criado além do fluxo de criação — tratado no detalhe
  (SPEC-07), não aqui.

## 5. Requisitos Funcionais

- RF01: `CUSTOMER` vê apenas os próprios tickets na listagem.
- RF02: Filtro por status atualiza a lista sem recarregar a página
  inteira.
- RF03: Criar ticket com campos válidos resulta em novo item na listagem.
- RF04: Criar ticket com `title` vazio exibe erro de validação sem
  submeter.

## 6. Requisitos Não Funcionais

- Responsivo, componentes shadcn/ui.
- Loading states (skeleton ou spinner) durante fetch da listagem.
- Tratamento de erro de rede/API (mensagem amigável, sem stack trace).

## 7. Dependências de Outras SPECs

- SPEC-03 (contrato de `POST/GET /tickets` e `POST /tickets/:id/attachments`).
- SPEC-05 (usuário autenticado, layout com sessão).

## 8. Decisões Pendentes

Nenhuma decisão nova identificada. Caso a decisão de máquina de estados da
SPEC-03 (seção 9 daquela SPEC) ainda não tenha sido resolvida até a
aprovação desta, esta SPEC fica `BLOCKED` (o formulário de criação depende
apenas do status inicial `OPEN`, mas os badges de status na listagem
dependem do enum completo já definido).

## 9. Critérios de Aceitação

- [ ] Listagem exibe apenas tickets do usuário logado.
- [ ] Filtro por status funcional.
- [ ] Criação de ticket funcional, com validação de erro exibida
      corretamente.
- [ ] Estado vazio exibido corretamente quando não há tickets.
- [ ] Testes Vitest (Testing Library) cobrindo: renderização da lista com
      dados mockados, filtro alterando a query, submissão do formulário de
      criação (sucesso e erro de validação).

## 10. Definition of Done

- Critérios de aceitação atendidos.
- Testes Vitest passando.
- Nenhuma chamada de API direta ao Prisma no client — sempre via `fetch`
  contra a API Nest (`apps/api`), nunca acesso a banco no frontend.

## 11. Riscos

- Nenhum risco significativo além dos já cobertos nas SPECs de
  dependência.
