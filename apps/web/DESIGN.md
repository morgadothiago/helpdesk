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
