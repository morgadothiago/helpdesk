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

### Progress bar de upload de anexo (correção pós-QA, Finding 1)

O `qa-reviewer` apontou que a auditoria original havia confirmado (via
`git show 61eb386:src/app/tickets/[id]/page.tsx`) que anexos de ticket já
existiam desde a SPEC-07 — logo a condição do item 4 do escopo se aplicava
e a progress bar de upload era esperada, mas o fluxo original desta SPEC
só trocava o texto do botão para "Enviando...", sem indicador de
progresso.

Resolvido com progresso real (não indeterminado): `uploadTicketAttachment`
(`src/lib/tickets.ts`) foi reimplementado com `XMLHttpRequest` em vez de
`fetch`, especificamente porque `XMLHttpRequest.upload.onprogress` expõe
`event.loaded`/`event.total` de forma amplamente suportada — `fetch` não
oferece uma forma equivalente e universalmente suportada de acompanhar
progresso de envio do corpo da requisição sem introduzir complexidade
desproporcional (streams de request body). O restante do módulo
`tickets.ts` continua em `fetch` (mais simples), já que nenhuma outra
chamada precisa de progresso.

Novo componente `Progress` (`src/components/ui/progress.tsx`, sem
dependência de `@radix-ui/react-progress`, ausente do projeto): barra
determinada (`aria-valuenow` em porcentagem) durante o upload, com
fallback indeterminado (`aria-valuetext="Enviando..."`) para o caso raro
de `event.lengthComputable` ser `false`. A animação do estado
indeterminado usa uma nova `@keyframes progress-indeterminate` em
`globals.css`, já coberta pela regra global de `prefers-reduced-motion`
acima. Exibida em `AttachmentsCard`
(`src/app/tickets/[id]/page.tsx`) junto do texto percentual, com o campo
de arquivo desabilitado durante o envio.

### Refinamento visual de `/login` e `/registro` (item 9, refeito no item 11 do escopo)

> **Nota de histórico**: a primeira versão desta seção (item 9 do escopo,
> commit `7c50878`) descrevia um layout de duas colunas com painel de
> pontos + dois halos e uma frase de apoio única, aprovado pelo
> `qa-reviewer` contra os critérios então escritos. Vendo o resultado no
> navegador, o usuário considerou esse resultado "básico demais" para um
> produto final apresentável — os critérios anteriores eram insuficientes,
> não a execução. O item 11 do escopo pediu uma refeita real (não um
> ajuste incremental) mantendo 100% do escopo funcional (email/senha,
> registro, `react-hook-form`/`yup`, `PasswordInput`, guards de rota). O
> texto abaixo **substitui integralmente** a descrição da versão anterior.
> Direção calibrada com a skill `ui-ux-design-pro` e os 4 arquivos de
> referência do usuário (`animation-and-3d.md`, `brazil-references.md`,
> `component-libraries.md`, `design-trends-2026.md`).

- **Painel de marca real, não decorativo genérico (`AuthShowcasePanel`,
  novo componente em `src/components/auth/auth-showcase-panel.tsx`,
  visível a partir de `lg:` ~1024px+)**: em vez do padrão de pontos +
  frase única da versão anterior, o painel agora usa o token `primary`/
  `primary-foreground` (a mesma cor do CTA principal, aqui aplicada de
  forma mais expressiva numa área grande — item 11.e, "extensão de uso,
  não paleta nova") como fundo sólido de marca, com: uma grade sutil
  (`.auth-grid-pattern`, `globals.css`, substitui `.auth-dot-pattern`),
  três blobs desfocados (`blur-3xl` sobre `bg-primary-foreground/10`/`/5`)
  simulando profundidade tipo mesh-gradient, o wordmark "Helpdesk" com
  ícone (`LifeBuoy`, `lucide-react`), uma headline de valor específica por
  tela (`tagline`, prop) em tipografia grande (`text-3xl`/`xl:text-4xl
  font-semibold`) e 3 destaques com ícone (`Inbox`/`Clock`/`MessageSquare`)
  que descrevem funcionalidade real já implementada (fila de tickets,
  `SlaIndicator`, `CommentThread`) — não é copy inventada/genérica.
  Elementos entram com `.animate-content-in` escalonado via
  `--stagger-delay` (reaproveita a keyframe já existente do item 10, não
  duplica). `aria-hidden` (decorativo, não é conteúdo funcional).
  Reutilizado por `/login` e `/registro` (ordem invertida via
  `lg:order-first` em `/registro`, mesmo padrão da versão anterior) — não
  duplicado entre as duas telas.
- **Card do formulário com profundidade real**: `max-w-md` (era
  `max-w-sm`), `rounded-3xl`, `shadow-2xl shadow-zinc-950/10`
  (`dark:shadow-black/40`) e `bg-card/95 backdrop-blur-sm` em vez da borda
  simples + `shadow-lg` da versão anterior — sombra calibrada e leve
  glassmorphism sobre o fundo com halos da página, não só uma borda de
  1px. Respiro maior: `CardHeader`/`CardContent`/`CardFooter` com
  `px-8`, `gap-6` entre campos (era `gap-5`) e mais padding vertical
  (`pt-8`/`pb-8`).
- **Fundo da página**: simplificado para `bg-background` + dois halos
  (`blur-3xl` sobre `bg-secondary/40`–`/50`) posicionados em cantos
  opostos, dando profundidade sem competir com o painel de marca (que já
  carrega o `bg-primary` sólido) — mesmos tokens `background`/`secondary`
  já existentes.
- **Tipografia expressiva no headline**: `CardTitle` de "Entrar"/"Criar
  conta" passou de `text-2xl font-semibold` (padrão do componente,
  reaproveitado sem override) para `text-3xl sm:text-4xl font-bold
  tracking-tight` nas duas telas — escala e peso maiores, comunicando mais
  confiança de produto, sem alterar o componente `CardTitle` compartilhado
  (override via `className` só nestas duas instâncias, para não afetar
  outras telas fora do escopo deste refinamento).
- **Animação de entrada do card**: `.animate-auth-card`
  (`globals.css`, `@keyframes auth-card-in`) evoluiu de
  `translateY(12px) → 0` linear para `translateY(20px) scale(0.98) → 0/1`
  com easing `cubic-bezier(0.16, 1, 0.3, 1)` (mais perceptível, "ease-out
  expo"-like) — mesma cobertura de `prefers-reduced-motion` global.
- **Micro-interações de foco**: cada campo (`email`, `name`,
  `PasswordInput`) ganhou `transition-transform duration-200
  focus-visible:-translate-y-0.5 focus-visible:ring-4
  focus-visible:ring-ring/20` via `className` só nas instâncias de
  `/login`/`/registro` (não no componente `Input` compartilhado, para não
  afetar `/tickets`/`/painel-agente`, fora do escopo deste item) — leve
  translação + glow de foco mais rico que a simples troca de cor de borda
  da versão anterior. `PasswordInput`
  (`src/components/ui/password-input.tsx`) recebeu o mesmo tratamento
  diretamente no wrapper (`focus-within:-translate-y-0.5`), já que input e
  botão de olho precisam escalar/transladar juntos para não desalinhar —
  ajuste puramente visual, lógica de toggle/acessibilidade
  (`aria-label`/`aria-pressed`/ordem de tab) inalterada.
- **Loading do botão "Entrar"/"Criar conta"**: em vez de só trocar o texto
  para "Entrando..."/"Criando conta...", o botão agora também exibe um
  spinner (`Loader2`, `lucide-react`, `animate-spin`, `aria-hidden`) ao
  lado do texto — o texto acessível (nome do botão) permanece o mesmo, só
  ganha um indicador visual adicional.
- **Hover states nos links** ("Criar conta"/"Entrar" no rodapé do card):
  sublinhado deixou de ser estático (`underline`) e passou a "revelar" no
  hover (`decoration-transparent` → `hover:decoration-current`, transição
  de cor), com foco de teclado visível (`focus-visible:ring-2`)
  preservado.
- **`PasswordInput` (item 9.b, mantido)**: mesmo componente
  `src/components/ui/password-input.tsx` da versão anterior (`Eye`/
  `EyeOff` de `lucide-react`, `aria-label` dinâmico, `aria-pressed`,
  `type="button"` explícito) — lógica 100% preservada, só recebeu o ajuste
  visual de foco descrito acima.

### Refinamento visual de `/tickets`, `/tickets/novo`, `/tickets/[id]` e `/painel-agente` (item 10 do escopo)

Item adicionado ao escopo da SPEC-09 a pedido do usuário (2026-08-03),
aplicando a skill `ui-ux-design-pro` (carregada antes de qualquer decisão
visual — ver `~/.claude/skills/ui-ux-design-pro/`) às 3 telas que ainda não
tinham recebido refinamento visual dedicado (login/registro já cobertos no
item 9). Mesma restrição do item 9: execução visual sobre o design system
já existente (paleta zinc, tokens, componentes consolidados na SPEC-09
seção 7), sem paleta nova nem alteração de escopo funcional/regras de
negócio.

- **`SlaIndicator` com mais destaque visual**: os estados "Atrasado" e
  "Vence em breve" passaram de texto simples com ícone para uma "pill"
  (borda + fundo tonal, arredondamento total), mesmo padrão visual já usado
  por `StatusBadge`/`PriorityBadge` — reforça a hierarquia em listas densas
  (tabela de `/tickets`, `/painel-agente`) sem introduzir cor nova (reusa
  `red-50`/`red-200`/`destructive` para atraso e `amber-50`/`amber-200`
  para "vence em breve", já documentados na seção anterior).
  `src/components/tickets/ticket-badges.tsx`.
- **Animação de entrada de conteúdo (`animate-content-in`)**: nova
  keyframe genérica em `globals.css` (fade + `translateY(8px) → 0`,
  `0.4s ease-out`), aplicada a: `TicketCard` (fallback mobile de
  `/tickets`/`painel-agente`), linhas de `TableRow` na tabela desktop de
  ambas as telas, `Card` de `/tickets/novo`, cada seção/`Card` de
  `/tickets/[id]` (detalhe, edição, anexos, comentários — com
  `--stagger-delay` crescente para dar sensação de sequência), itens de
  `CommentThread` e os `SummaryCard` do painel do agente. A variável CSS
  `--stagger-delay` (via `style` inline, calculada por índice do item,
  capada em 8 itens para não atrasar demais listas longas) permite
  escalonar a entrada de itens de lista sem duplicar a keyframe por item.
  Mesma cobertura de `prefers-reduced-motion` da regra global já existente
  (zera a duração da animação).
- **Microinterações de hover/transição de estado**: `TicketCard` e
  `SummaryCard` (painel do agente) ganharam `transition-shadow
  hover:shadow-md`; itens de `CommentThread` e a lista de anexos em
  `/tickets/[id]` ganharam `transition-colors hover:bg-muted/30`. Linhas de
  `TableRow` já tinham hover (`hover:bg-muted/50`, componente base do
  shadcn, sem alteração).
- **`CommentThread` com avatar**: cada comentário passou a exibir um
  círculo com as iniciais do autor (`bg-secondary`/`text-secondary-foreground`,
  decorativo — `aria-hidden`), referência de padrão de thread de conversa
  usado por produtos de helpdesk/suporte reais (Zendesk, Intercom) — sem
  introduzir cor por papel de usuário (permaneceria fora da paleta
  semântica reservada a status/prioridade/SLA).
  `src/components/tickets/comment-thread.tsx`.
- **`SummaryCard` (painel do agente) com ícone temático**: os 3 cards de
  contadores do topo (`Abertos`/`Não atribuídos`/`Atrasados`) ganharam um
  ícone (`Inbox`/`UserRoundX`/`AlertTriangle`, `lucide-react`) num círculo
  neutro (`bg-secondary`) — o card "Atrasados" reaproveita `destructive`
  (mesmo tom do `SlaIndicator`) quando o contador é maior que zero, em vez
  de introduzir uma cor nova. `src/app/painel-agente/page.tsx`.
- **Estados vazios com ícone**: "Você ainda não abriu nenhum ticket."
  (`/tickets`) e "Nenhum ticket no sistema no momento." (`/painel-agente`)
  ganharam um ícone (`TicketIcon`/`Inbox`) num círculo neutro acima do
  texto, para dar mais hierarquia visual ao estado vazio — mesmo padrão
  "calm interface" (ícone + texto + CTA) já usado em produtos SaaS de
  referência, sem alterar a mensagem/CTA existente.
- Nenhum campo, endpoint, regra de negócio ou texto funcional foi alterado
  — apenas classes/markup puramente visuais, validado contra os 40 testes
  Vitest existentes das 4 telas (nenhum teste ajustado; todos passam sem
  modificação, já que dependem de texto/roles, não de classes CSS).
