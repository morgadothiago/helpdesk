import { TicketStatus } from '@prisma/client';
import { TERMINAL_STATUSES } from '../constants/status-transitions.constants';

/** Subconjunto mínimo de `Ticket` necessário para derivar `overdue` (SPEC-01, seção 3.1). */
export interface OverdueInput {
  dueAt: Date | null;
  status: TicketStatus;
  closedAt: Date | null;
}

/**
 * Deriva `overdue` a partir de `dueAt`/`status`/`closedAt` no momento da
 * consulta (nunca persistido — SPEC-01, seção 3.1):
 * - Ticket ainda aberto (`status` não é `RESOLVED`/`CLOSED`): atrasado se
 *   `dueAt < now()`.
 * - Ticket resolvido/fechado: `dueAt` está congelado; atrasado se foi
 *   resolvido fora do prazo (`closedAt > dueAt`), i.e. `overdue` é o oposto
 *   de `closedAt <= dueAt`.
 */
export function isOverdue(
  ticket: OverdueInput,
  now: Date = new Date(),
): boolean {
  if (!ticket.dueAt) {
    return false;
  }

  const isTerminal = TERMINAL_STATUSES.includes(ticket.status);
  if (isTerminal) {
    if (!ticket.closedAt) {
      return false;
    }
    return ticket.closedAt.getTime() > ticket.dueAt.getTime();
  }

  return ticket.dueAt.getTime() < now.getTime();
}
