import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  CATEGORY_LABELS,
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

/** Indicador visual de atraso de SLA (`overdue: true`, SPEC-03/SPEC-06). */
export function OverdueIndicator() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
      <AlertTriangle className="size-3.5" aria-hidden="true" />
      Atrasado
    </span>
  );
}
