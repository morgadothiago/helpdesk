import { AlertTriangle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  CATEGORY_LABELS,
  formatDateTime,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from '@/lib/tickets';

/**
 * Cores semânticas por status/prioridade (SPEC-06, decisão de design do
 * dev-frontend — ver `apps/web/DESIGN.md`). Complementa a paleta neutra
 * (zinc + destructive) definida na SPEC-05 com tons de apoio (azul, âmbar,
 * roxo, verde) reservados exclusivamente para badges de estado, mantendo o
 * restante da UI neutra. Contraste testado nas variantes light/dark.
 */
const STATUS_STYLES: Record<TicketStatus, string> = {
  OPEN: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300',
  IN_PROGRESS:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
  WAITING_CUSTOMER:
    'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-300',
  RESOLVED:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  CLOSED:
    'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-400',
};

const PRIORITY_STYLES: Record<TicketPriority, string> = {
  LOW: 'border-zinc-200 bg-transparent text-zinc-600 dark:border-zinc-800 dark:text-zinc-400',
  MEDIUM:
    'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  HIGH: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
  URGENT:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <Badge variant="outline" className={cn(STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <Badge variant="outline" className={cn(PRIORITY_STYLES[priority])}>
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}

export function CategoryBadge({ category }: { category: TicketCategory }) {
  return <Badge variant="secondary">{CATEGORY_LABELS[category]}</Badge>;
}

/** Janela de proximidade de vencimento considerada "aviso" (SPEC-09, seção 2/4). */
const SLA_WARNING_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Indicador visual de SLA (`dueAt`/`overdue`, SPEC-03/SPEC-06/SPEC-09):
 * consolida em um único componente reutilizável a exibição do prazo mais o
 * reforço visual de proximidade — usado nas 3 telas que exibem prazo de
 * ticket (`/tickets`, `/tickets/[id]`, `/painel-agente`), eliminando a
 * duplicação de JSX que existia entre elas.
 *
 * Três estados, cada um com cor + ícone (nunca só cor, para acessibilidade).
 * Estados de aviso/atraso ganham destaque de "pill" (borda + fundo tonal,
 * mesmo padrão visual de `StatusBadge`/`PriorityBadge`) desde a SPEC-09
 * item 10, para chamar mais atenção em listas densas do que texto simples:
 * - Atrasado (`overdue: true`): `destructive` (vermelho) + `AlertTriangle`.
 * - Vence em breve (prazo dentro de 24h, ainda não atrasado): cor de aviso
 *   âmbar dedicada (`amber-600`/`amber-400`) — deliberadamente distinta do
 *   `accent` neutro do design system (DESIGN.md, "cor de aviso separada do
 *   accent") — + `Clock`.
 * - Dentro do prazo / sem prazo definido: apenas a data, sem destaque.
 */
export function SlaIndicator({
  dueAt,
  overdue,
}: {
  dueAt: string | null;
  overdue: boolean;
}) {
  const dueDate = dueAt ? new Date(dueAt) : null;
  const isValidDate = dueDate !== null && !Number.isNaN(dueDate.getTime());
  // `Date.now()` é impuro (React Compiler acusaria "impure function during
  // render"), mas o resultado é só um indicador visual decorativo de
  // proximidade — não precisa ser perfeitamente reativo a cada milissegundo,
  // apenas correto na renderização atual. Desabilitado deliberadamente.
  // eslint-disable-next-line react-hooks/purity
  const msRemaining = isValidDate ? dueDate.getTime() - Date.now() : null;
  const isDueSoon =
    !overdue &&
    msRemaining !== null &&
    msRemaining >= 0 &&
    msRemaining <= SLA_WARNING_WINDOW_MS;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-foreground">{formatDateTime(dueAt)}</span>
      {overdue ? (
        <span className="inline-flex w-fit items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-destructive dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <AlertTriangle className="size-3.5" aria-hidden="true" />
          Atrasado
        </span>
      ) : isDueSoon ? (
        <span className="inline-flex w-fit items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          <Clock className="size-3.5" aria-hidden="true" />
          Vence em breve
        </span>
      ) : null}
    </div>
  );
}
