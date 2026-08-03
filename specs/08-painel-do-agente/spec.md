# SPEC-08: Painel do Agente

- **ID:** SPEC-08
- **Nome:** Painel do agente (fila de tickets, atribuição, triagem)
- **Status:** APPROVED
- **Domain:** frontend
- **Dependências:** SPEC-03 (API de tickets CRUD), SPEC-05 (telas de autenticação), SPEC-07 (tela de detalhe do ticket)

## 1. Objetivo

Implementar a visão de trabalho do `AGENT`/`ADMIN`: uma fila com todos os
tickets do sistema, filtros por status/prioridade/atribuição, e ações
rápidas de triagem (assumir ticket, mudar prioridade).

## 2. Contexto

Fecha o MVP do helpdesk do lado do time de suporte, reaproveitando a tela de
detalhe (SPEC-07) para o trabalho fino em cada ticket, e adicionando aqui a
visão de fila/painel.

## 3. Escopo

- Página `/painel-agente` (`src/app/painel-agente/page.tsx`), acessível
  apenas a `AGENT`/`ADMIN` (verificado tanto pelo middleware da SPEC-02
  quanto por um guard visual redirecionando `CUSTOMER` para `/tickets`).
  - Tabela com todos os tickets (via `GET /tickets`), colunas: título,
    cliente (nome do `createdBy`), status, prioridade, categoria, prazo de
    SLA (`dueAt`, com destaque visual quando `overdue: true`), agente
    responsável, data de criação.
  - Filtros: `status`, `priority`, `category`, `assignedToId` (com opção
    "Não atribuídos" e "Meus tickets" = `assignedToId = session.user.id`),
    e `overdue` (mostrar só atrasados).
  - Ação rápida "Assumir" em tickets não atribuídos (seta
    `assignedToId = session.user.id` via `PATCH`) direto na linha da
    tabela, sem precisar abrir o detalhe.
  - Ordenação por coluna (ao menos por `createdAt` e `priority`).
  - Paginação.
  - Link de cada linha para o detalhe completo (SPEC-07).
  - Contadores/resumo no topo (ex.: "X abertos", "Y não atribuídos",
    "Z atrasados") — calculado a partir dos dados já buscados ou de uma
    chamada agregada simples (decisão de implementação do dev-frontend,
    sem exigir novo endpoint dedicado a menos que necessário).

## 4. Fora do Escopo

- Reatribuição em massa/bulk actions — fora do MVP.
- Dashboards/gráficos avançados — fora do MVP.
- Alertas ativos (email/push) de SLA vencendo — fora do MVP; o painel só
  exibe o indicador visual de `overdue` já calculado pela API (SPEC-03),
  sem notificação proativa.

## 5. Requisitos Funcionais

- RF01: `CUSTOMER` acessando `/painel-agente` é redirecionado / recebe
  403 tratado com página amigável.
- RF02: `AGENT` vê todos os tickets do sistema, não apenas os próprios.
- RF03: Filtro "Não atribuídos" mostra apenas tickets com
  `assignedToId: null`.
- RF04: Ação "Assumir" atribui o ticket ao agente logado e atualiza a
  tabela sem reload completo.
- RF05: Filtro "Meus tickets" mostra apenas tickets atribuídos ao agente
  logado.

## 6. Requisitos Não Funcionais

- Responsivo (tabela com scroll horizontal em telas pequenas, ou
  visualização em cards alternativa).
- Performance razoável com paginação no backend (não carregar todos os
  tickets de uma vez sem paginação).

## 7. Dependências de Outras SPECs

- SPEC-03 (contrato de `GET`/`PATCH /tickets`).
- SPEC-05 (autenticação/sessão de UI).
- SPEC-07 (navegação para o detalhe).

## 8. Decisões Pendentes

Nenhuma decisão nova identificada além das já registradas e potencialmente
pendentes nas SPECs 00, 03 e 04. Se qualquer uma delas ainda não estiver
resolvida na aprovação desta SPEC, esta fica `BLOCKED`.

## 9. Critérios de Aceitação

- [ ] Todos os RFs da seção 5 verificados.
- [ ] `CUSTOMER` não consegue acessar o painel (nem via URL direta).
- [ ] Filtros combináveis funcionam corretamente (ex.: status + prioridade
      juntos).
- [ ] Testes Vitest (Testing Library) cobrindo: renderização da fila com
      dados mockados, ação "Assumir" atualizando a linha, guard de acesso
      para `CUSTOMER`.

## 10. Definition of Done

- Critérios de aceitação atendidos.
- Testes Vitest passando.
- Reaproveita componentes já criados nas SPECs 06/07 sempre que possível
  (badges de status/prioridade, formatação de data, etc.) em vez de
  duplicar.

## 11. Riscos

- Nenhum risco adicional além dos já mapeados nas SPECs de dependência.
  Este é o fechamento funcional do MVP proposto.
