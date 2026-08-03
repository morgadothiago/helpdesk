import { TicketPriority } from '@prisma/client';

/**
 * Tabela de prazos de SLA por prioridade (SPEC-01, seção 3.1 — INFERRED,
 * horas corridas a partir de `createdAt`, sem calendário útil).
 */
export const SLA_HOURS_BY_PRIORITY: Record<TicketPriority, number> = {
  URGENT: 4,
  HIGH: 8,
  MEDIUM: 24,
  LOW: 72,
};

/**
 * Calcula `dueAt` a partir de `createdAt` e `priority` (SPEC-01, seção 3.1).
 * Reaproveitado tanto na criação quanto no recálculo por mudança de
 * prioridade (SPEC-03, seção 3 — a partir do `createdAt` original, nunca do
 * momento da mudança).
 */
export function calculateDueAt(
  createdAt: Date,
  priority: TicketPriority,
): Date {
  const hours = SLA_HOURS_BY_PRIORITY[priority];
  return new Date(createdAt.getTime() + hours * 60 * 60 * 1000);
}
