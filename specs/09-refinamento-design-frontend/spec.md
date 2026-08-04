# SPEC-09: Refinamento de Design e Qualidade de Código — Telas SPEC-05 a SPEC-08

status: APPROVED
domain: frontend

## Objetivo

Refinar qualidade visual, responsividade, acessibilidade e qualidade de
código das telas já implementadas (SPEC-05 login/registro, SPEC-06
listagem/criação de tickets, SPEC-07 detalhe do ticket, SPEC-08 painel do
agente), sem alterar escopo funcional (nenhum campo, tela ou regra de
negócio nova).

## Contexto

SPEC-00 a SPEC-08 estão `IMPLEMENTED` e commitadas (main, push feito para
o GitHub). `apps/web/DESIGN.md` já existe (paleta zinc + tokens semânticos
via `@theme inline` no Tailwind v4, dark mode de primeira classe, decidido
na SPEC-05). Nenhum formulário atual usa `react-hook-form`/`yup`
(confirmado em `apps/web/package.json` — dependências ausentes). Testes
Vitest existentes cobrem: `tests/login.test.tsx`, `tests/registro.test.tsx`,
`tests/auth.test.tsx`, `tests/middleware.test.tsx`, `tests/tickets.test.tsx`,
`tests/tickets-novo.test.tsx`, `tests/tickets-detail.test.tsx`,
`tests/painel-agente.test.tsx`, `tests/smoke.test.ts`.

## Escopo

1. Auditar `apps/web/DESIGN.md` vs. telas reais; corrigir divergências e
   cores/tamanhos hardcoded fora dos tokens do design system existente
   (não recriar o sistema — ele já existe e deve ser preservado/estendido).
2. Revisar paleta/tipografia quanto a semântica de status/prioridade/SLA
   (cor de aviso separada do accent), preservando a decisão de paleta zinc
   já tomada na SPEC-05 (documentada em DESIGN.md) — extensão, não
   substituição de paleta.
3. Auditoria de responsividade (~375px / ~768px / ~1280px+) e
   acessibilidade (contraste AA, navegação por teclado, aria-*, tap
   targets) nas 4 telas/fluxos citados. Tabelas com fallback em card para
   telas pequenas. Garantir feedback de loading/erro/sucesso onde faltar.
4. Indicador visual de SLA (dueAt/overdue, cor conforme proximidade do
   prazo) e progress bar de upload de anexo, se anexos já existirem no
   fluxo implementado da SPEC-07 — sem criar campo/funcionalidade nova de
   anexo caso não exista ainda (ver "Fora do escopo").
5. Microinterações discretas respeitando `prefers-reduced-motion`.
6. Migração de todos os formulários existentes (login, registro, criação
   de ticket, novo comentário, edição, se existir) para
   `react-hook-form` + `@hookform/resolvers` (resolver yup), com schema
   yup espelhando a validação já existente no backend (zod), mensagens de
   erro em português associadas ao campo.
7. Extração/consolidação de componentes reutilizáveis sem lógica de UI
   duplicada entre SPEC-06/07/08: `StatusBadge`, `PriorityBadge`,
   `SlaIndicator`, `TicketCard`, `CommentThread` (ou equivalentes já
   existentes — consolidar, não duplicar).
8. Refatoração de componentes compartilhados com muitas props booleanas
   (Table, Card, Dialog) para padrão de composição
   (children/slots/compound components).

## Fora do escopo

- Qualquer campo, tela, rota, regra de negócio ou funcionalidade nova.
- Mudança de paleta base (zinc) ou de stack (Next.js, Tailwind v4,
  shadcn/ui) — decisões já `CONFIRMED` nas SPECs anteriores.
- Alterações em `apps/api` (backend).
- Se a auditoria revelar que anexos em ticket não estão implementados na
  SPEC-07 original, isso é reportado como `SCOPE CONFLICT`, não
  implementado ad-hoc.

## Requisitos não funcionais

- Todos os testes Vitest existentes devem continuar passando após o
  refinamento (`pnpm --filter web test` ou equivalente).
- `qa-reviewer` deve ser acionado ao final pelo orquestrador antes de a
  SPEC ser considerada `IMPLEMENTED`.
- Nenhuma regressão funcional nas 4 telas/fluxos.

## Dependências

- `react-hook-form`, `@hookform/resolvers`, `yup` (adicionar a
  `apps/web/package.json` caso ausentes — confirmado ausentes hoje).

## Critérios de aceitação

- `apps/web/DESIGN.md` atualizado refletindo o estado real pós-refinamento
  (ou confirmado sem divergência, se auditoria não encontrar nada a
  corrigir).
- Todos os formulários das 4 telas usando `react-hook-form` + yup.
- Componentes `StatusBadge`/`PriorityBadge`/`SlaIndicator`/`TicketCard`/
  `CommentThread` (ou equivalentes) existindo em local único, reutilizados
  nas telas correspondentes.
- Testes Vitest passando.
- Relato tela a tela do que mudou (diff resumido) entregue pelo
  dev-frontend ao final.
- Nenhum `SCOPE CONFLICT` pendente sem reporte explícito.

## Restrições de implementação

- Não pausar para aprovação de detalhes de execução dentro do escopo
  acima (já aprovado via este SPEC); pausar apenas diante de decisão de
  arquitetura genuinamente nova ou `SCOPE CONFLICT`.
- Se detectar outro processo alterando os mesmos arquivos
  concorrentemente, parar e reportar antes de continuar.
- Commit final com testes passando, mensagem no padrão:
  `refactor(web): refina design system e formulários com rhf+yup`.
