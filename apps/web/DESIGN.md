# Design System — Helpdesk (apps/web)

Decisões de direção visual tomadas na SPEC-05 (primeira tela real do
produto, telas de autenticação). Mantenha este documento sincronizado com
`src/app/globals.css` — qualquer nova SPEC de tela deve reutilizar estes
tokens em vez de introduzir cores/espaçamentos ad-hoc.

## Referências

Neutros (zinc) dominantes com um accent forte reservado para CTAs
primários, bordas suaves, densidade de informação alta mas organizada,
dark mode de primeira classe — padrão observado em Linear, Zendesk,
Intercom e no showcase oficial do shadcn/ui (tendência 2025/2026 para
SaaS/ferramentas internas como um helpdesk).

## Paleta

Baseada na escala `zinc` (base color já configurada em `components.json`),
com tokens semânticos (CSS variables) definidos em `globals.css` e
expostos ao Tailwind v4 via `@theme inline`:

| Token | Light | Dark | Uso |
|---|---|---|---|
| `background` / `foreground` | `#fff` / `zinc-950` | `zinc-950` / `#fafafa` | fundo e texto base da página |
| `card` / `card-foreground` | branco | `zinc-900` | superfícies elevadas (formulários, cards) |
| `primary` / `primary-foreground` | `zinc-900` / `#fafafa` | `#fafafa` / `zinc-900` | CTA principal (botão de submit) |
| `secondary` / `muted` / `accent` | `zinc-100` | `zinc-800` | fundos secundários, hover, texto auxiliar |
| `destructive` | `red-600` | `red-400` | erros de validação/credenciais inválidas |
| `border` / `input` / `ring` | `zinc-200` | `zinc-800` | bordas de campos, foco |

Não há uma segunda cor de "marca" agressiva neste MVP — o accent visual
vem do contraste alto entre `primary` (quase preto/quase branco) e o
fundo neutro, seguindo o padrão de ferramentas internas B2B. Se o produto
precisar de uma cor de marca distintiva no futuro, isso deve ser proposto
como SPEC própria (não decidido ad-hoc numa tela isolada).

## Tipografia

- Fonte: `Geist Sans` (texto) / `Geist Mono` (código), via `next/font`,
  já configurado em `src/app/layout.tsx` (SPEC-00).
- Escala usada nas telas de autenticação: título de card `text-2xl
  font-semibold`, corpo/labels `text-sm`, texto auxiliar `text-sm
  text-muted-foreground`, mensagens de erro `text-sm` dentro de `Alert`
  (`role="alert"`).

## Espaçamento e raio

- Raio base `--radius: 0.625rem` (10px), com variantes derivadas
  (`sm`/`md`/`lg`/`xl`) expostas via `@theme inline` — mesma convenção do
  shadcn/ui padrão.
- Espaçamento segue a escala padrão do Tailwind (múltiplos de 4px); telas
  de autenticação usam `gap-4`/`gap-6` entre campos e `p-6` como padding
  interno de card, consistente com os componentes shadcn instalados
  (`Card`, `CardContent`).

## Componentes shadcn/ui utilizados

`Button` (já existente, SPEC-00), `Input`, `Label`, `Card` (+
`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter`),
`Alert` (+ `AlertDescription`, variante `destructive` para erros)
instalados via `shadcn add` nesta SPEC.

`Table`, `Select`, `Badge`, `Skeleton`, `Textarea` instalados via
`shadcn add` na SPEC-06 (telas de tickets do customer), reutilizando os
mesmos tokens `zinc`/`primary`/`destructive` acima — nenhuma nova cor de
base introduzida no design system.

### Cores semânticas de status/prioridade (SPEC-06)

Badges de `status` e `priority` de ticket usam tons de apoio (azul, âmbar,
roxo, verde) além da paleta neutra, reservados exclusivamente para esse
uso — o restante da UI permanece neutro, seguindo a mesma lógica de "um
accent por vez" da seção Paleta acima. Ver
`src/components/tickets/ticket-badges.tsx` para o mapeamento completo
(`STATUS_STYLES`/`PRIORITY_STYLES`). O indicador de atraso de SLA
(`overdue: true`) usa a cor `destructive` já definida no design system,
combinada com um ícone (`AlertTriangle`, `lucide-react`) para reforço
visual além da cor (acessibilidade — não depende só de cor para
comunicar o estado).

## Responsividade

Mobile-first: formulários de autenticação ocupam a largura total da tela
em mobile (`w-full`, padding lateral) e são centralizados em um card de
largura máxima fixa (`max-w-sm`) a partir do breakpoint `sm:` (~640px).
Validado mentalmente/pelo layout em três larguras de referência: ~375px
(mobile), ~768px (tablet), ~1280px+ (desktop) — sem scroll horizontal em
nenhuma delas.

A listagem de tickets (SPEC-06, `/tickets`) segue o padrão "tabela →
cards": `Table` visível a partir do breakpoint `md:` (~768px), lista de
`Card`s empilhados abaixo disso — evita scroll horizontal em telas de
smartphone sem perder densidade de informação em telas maiores.

## Acessibilidade

- Todo campo de formulário tem `<Label htmlFor>` associada.
- Erros de validação/API são anunciados via `role="alert"` (componente
  `Alert`) e referenciados nos campos relevantes via `aria-describedby`
  quando aplicável.
- Área de toque dos botões respeita o tamanho mínimo padrão do
  componente `Button` do shadcn (`h-9`/`h-10`), navegável por teclado
  (elementos nativos `button`/`input`, sem `div` clicável).

## SPEC-09 — Refinamento de design, formulários e componentes

Auditoria feita nas 4 telas/fluxos já `IMPLEMENTED` (SPEC-05 a SPEC-08).
Resultado: o design system e a estrutura de componentes descritos acima já
estavam alinhados ao que foi de fato implementado — nenhuma divergência de
paleta/tipografia/espaçamento encontrada entre este documento e o código.
As mudanças desta SPEC foram extensões pontuais, não correções:

### Formulários — `react-hook-form` + `yup`

Todos os formulários das 4 telas (login, registro, criação de ticket,
edição de ticket pelo `CUSTOMER`, gerenciamento de ticket pelo
`AGENT`/`ADMIN`, novo comentário) migraram de estado controlado manual
(`useState` + validação ad-hoc) para `react-hook-form` +
`@hookform/resolvers/yup`, com schemas em `src/lib/validation.ts`
espelhando a validação já existente no backend (`zod`/`class-validator`):
`loginSchema` (`LoginDto`), `registerSchema` (`RegisterDto`),
`ticketFieldsSchema` (`createTicketSchema`, reaproveitado tanto na criação
quanto na edição de título/descrição), `commentSchema`
(`createCommentSchema`) e `agentEditSchema` (subconjunto de
`updateTicketSchema` editável pelo agente). Mensagens de erro sempre em
português, associadas ao campo via `aria-invalid`/texto com `role="alert"`
logo abaixo do campo — mesmo padrão visual que já existia antes da
migração, agora orientado pelo schema em vez de checagens manuais.

Os campos `<Select>` (status/prioridade/categoria) continuam controlados
via `watch`/`setValue` do `react-hook-form` em vez de `register` — o
`Select` do Radix/shadcn não expõe um elemento `<select>` nativo compatível
com `register` (mesma limitação documentada por toda a comunidade
shadcn/RHF). Campos de arquivo (`input[type=file]`, anexo de
ticket/comentário) permanecem fora do schema `yup` — não existe schema
`zod` de validação de arquivo no backend para espelhar (a validação de
tamanho/tipo acontece no `multer`/`CommentsService`, fora do escopo desta
SPEC alterar).

### Indicador de SLA — `SlaIndicator`

Consolidado em `src/components/tickets/ticket-badges.tsx`: um único
componente `SlaIndicator({ dueAt, overdue })` substitui a duplicação de
"data + indicador de atraso" que existia separadamente em `/tickets`,
`/tickets/[id]` e `/painel-agente`. Três estados, sempre com cor + ícone
(nunca só cor):

- **Atrasado** (`overdue: true`): `destructive` (vermelho) + `AlertTriangle`.
- **Vence em breve** (prazo dentro de 24h, ainda não atrasado): cor de
  aviso âmbar dedicada (`amber-600`/`amber-400`), deliberadamente distinta
  do `accent` neutro da paleta — o design system não reutiliza a mesma cor
  para "aviso" e para elementos neutros de UI. + ícone `Clock`.
- **Dentro do prazo / sem prazo definido**: apenas a data, sem destaque.

### Componentes consolidados (sem duplicação entre telas)

- `StatusBadge`/`PriorityBadge`/`CategoryBadge`/`SlaIndicator` —
  `src/components/tickets/ticket-badges.tsx` (já existiam desde a SPEC-06;
  `SlaIndicator` é novo nesta SPEC, substitui o antigo `OverdueIndicator`).
- `TicketCard` — `src/components/tickets/ticket-card.tsx` (novo): card do
  fallback "tabela → card" (`< md`), antes duplicado entre `/tickets` e
  `/painel-agente`. Composição via slots (`leading`/`trailing`/`action`)
  em vez de props booleanas, para acomodar os campos extras específicos de
  cada tela (ex.: "Cliente"/"Agente responsável"/botão "Assumir" só no
  painel do agente) sem o componente precisar conhecer todas as variações.
- `CommentThread` — `src/components/tickets/comment-thread.tsx` (novo):
  lista de comentários extraída de `/tickets/[id]` como componente de
  exibição puro (sem lógica de busca/envio), reutilizável se uma futura
  tela precisar do mesmo thread.

### `Table`/`Card`/`Dialog` — composição vs. props booleanas

Auditoria não encontrou violação a corrigir: `Table` e `Card`
(`src/components/ui/table.tsx`, `src/components/ui/card.tsx`) já seguem o
padrão de composição do shadcn/ui (compound components via `children`,
`Table`/`TableHeader`/`TableBody`/`TableRow`/`TableCell`,
`Card`/`CardHeader`/`CardContent`/`CardFooter`), sem props booleanas.
`Badge`/`Button`/`Alert` usam `variant` (`cva`), não booleans soltos. Não
existe componente `Dialog` na base de código (nenhuma tela das SPEC-05 a
SPEC-08 usa modal) — nada a refatorar aí; se uma SPEC futura introduzir
`Dialog`, deve nascer já como compound component (`Dialog`/
`DialogTrigger`/`DialogContent`), não com prop `open`/variantes booleanas
soltas.

### Microinterações e `prefers-reduced-motion`

Regra global em `src/app/globals.css` (`@media (prefers-reduced-motion:
reduce)`) zera duração de animação/transição para todo elemento quando o
usuário configura essa preferência no SO — cobre tanto as
animações do Radix `Select` (`data-[state=open]:animate-in`, SPEC-06)
quanto o `animate-pulse` dos `Skeleton` de loading (SPEC-06/07/08), sem
precisar de variantes condicionais espalhadas por componente.
