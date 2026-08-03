import { TicketStatus } from '@prisma/client';

/**
 * Mapa de transições válidas de `Ticket.status` (SPEC-03, seção 9 —
 * CONFIRMED). Única fonte de verdade, reaproveitada por
 * `TicketsService.assertValidTransition` e por qualquer caminho futuro que
 * escreva `Ticket.status` (incluindo o gatilho da SPEC-04), conforme SPEC-03
 * seção 6 (RNF).
 */
export const VALID_STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: [TicketStatus.IN_PROGRESS],
  IN_PROGRESS: [TicketStatus.WAITING_CUSTOMER, TicketStatus.RESOLVED],
  WAITING_CUSTOMER: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED],
  RESOLVED: [TicketStatus.CLOSED, TicketStatus.OPEN, TicketStatus.IN_PROGRESS],
  CLOSED: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS],
};

/** Status que, se alcançados, "congelam" `dueAt` e setam `closedAt` (SPEC-01 seção 3.1 / SPEC-03 seção 3). */
export const TERMINAL_STATUSES: readonly TicketStatus[] = [
  TicketStatus.RESOLVED,
  TicketStatus.CLOSED,
];

/** Reabertura explícita (exceção ao fluxo linear, SPEC-03 seção 9): limpa `closedAt`. */
export const REOPEN_STATUSES: readonly TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
];
