# SPEC-07: Tela de Detalhe do Ticket e Comentários

- **ID:** SPEC-07
- **Nome:** Tela de detalhe do ticket com histórico de comentários
- **Status:** IMPLEMENTED
- **Domain:** frontend
- **Dependências:** SPEC-04 (API de comentários), SPEC-06 (telas de criação/listagem de tickets)

## 1. Objetivo

Implementar a tela de detalhe de um ticket individual, exibindo seus dados,
o histórico de comentários, e permitindo adicionar novos comentários —
compartilhada entre `CUSTOMER` e `AGENT`/`ADMIN` com pequenas diferenças de
permissão visual.

## 2. Contexto

Complementa a SPEC-06 (que só lista/cria tickets) com a visualização
detalhada e a conversa (comentários), usando a API da SPEC-04.

## 3. Escopo

- Página `/tickets/:id` (`src/app/tickets/[id]/page.tsx`):
  - Exibe título, descrição, status, prioridade, categoria, prazo de SLA
    (`dueAt`) com indicador visual de atraso quando `overdue: true`,
    autor, agente responsável (se houver), datas.
  - Lista de anexos do ticket (`GET /tickets/:id/attachments`), com link
    de download autenticado; formulário para adicionar novo anexo
    (`POST /tickets/:id/attachments`), desabilitado se o ticket estiver
    `CLOSED`.
  - `CUSTOMER`: pode editar `title`/`description` apenas enquanto
    `status === 'OPEN'` (conforme regra da SPEC-03); campos somem/ficam
    read-only quando não permitido.
  - `AGENT`/`ADMIN`: pode alterar `status`, `priority`, `category`, e
    atribuir/reatribuir (`assignedToId`) via selects, chamando
    `PATCH /tickets/:id`.
  - Lista de comentários (`GET /tickets/:id/comments`), ordenada
    cronologicamente, exibindo autor, papel, conteúdo e anexos do
    comentário (se houver, com link de download).
  - Formulário de novo comentário (`POST /tickets/:id/comments`, com
    anexo de arquivo opcional), desabilitado se o ticket estiver
    `CLOSED`, com mensagem explicando o motivo.
  - Acesso indevido (`CUSTOMER` tentando ver ticket de outro) trata o 404
    retornado pela API exibindo página "não encontrado", nunca um erro
    genérico que sugira que o ticket existe.

## 4. Fora do Escopo

- Lista de todos os tickets (visão do agente) — SPEC-08.
- Edição/exclusão de comentários — fora do MVP (ver SPEC-04).

## 5. Requisitos Funcionais

- RF01: `CUSTOMER` acessando ticket próprio vê todos os dados e pode
  comentar (se não `CLOSED`).
- RF02: `CUSTOMER` acessando ticket de outro usuário vê página "não
  encontrado".
- RF03: `AGENT` altera `status` e a UI reflete a mudança sem reload
  completo.
- RF04: Novo comentário aparece na lista imediatamente após envio bem
  sucedido (otimista ou via refetch).
- RF05: Formulário de comentário desabilitado com ticket `CLOSED`.

## 6. Requisitos Não Funcionais

- Responsivo, componentes shadcn/ui (`Badge` para status/prioridade,
  `Select`, `Textarea`, `Separator`, etc.).
- Loading e erro tratados em cada chamada de API (detalhe, comentários,
  submissão).

## 7. Dependências de Outras SPECs

- SPEC-04 (contrato de comentários e anexos de comentário).
- SPEC-03 (contrato de `PATCH /tickets/:id` e anexos de ticket, via
  SPEC-06/dependências já estabelecidas).
- SPEC-06 (navegação a partir da listagem).

## 8. Decisões Pendentes

Nenhuma nova. Depende da resolução das decisões pendentes já registradas nas
SPEC-03 (seção 9) e SPEC-04 (seção 9) — se ainda não resolvidas na
aprovação desta SPEC, esta fica `BLOCKED`.

## 9. Critérios de Aceitação

- [ ] Todos os RFs da seção 5 verificados manualmente e via teste
      automatizado.
- [ ] Permissões visuais corretas por papel (campos editáveis variam
      conforme `CUSTOMER` vs `AGENT`/`ADMIN`).
- [ ] Testes Vitest (Testing Library) cobrindo: renderização do detalhe
      com dados mockados, envio de comentário, alteração de status por
      agente (mock de API), bloqueio de comentário em ticket fechado.

## 10. Definition of Done

- Critérios de aceitação atendidos.
- Testes Vitest passando.
- Nenhuma regra de autorização decidida apenas no frontend — toda
  restrição real é imposta pela API; o frontend só reflete visualmente.

## 11. Riscos

- Divergência entre o que a UI permite editar e o que a API realmente
  aceita pode gerar erros 403 inesperados — mitigar validando o contrato
  da SPEC-03/04 antes de finalizar os formulários.
