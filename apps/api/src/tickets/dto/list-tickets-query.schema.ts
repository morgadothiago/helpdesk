import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';
import { z } from 'zod';

const booleanFromQuery = z
  .union([z.literal('true'), z.literal('false')])
  .transform((value) => value === 'true');

const intFromQuery = (defaultValue: number) =>
  z
    .string()
    .optional()
    .transform((value) => (value === undefined ? defaultValue : Number(value)))
    .pipe(z.number().int().min(1));

/**
 * `GET /tickets` (SPEC-03, seção 3/7): filtros e paginação. `assignedToId`
 * aceita o valor especial `"unassigned"` (SPEC-03, seção 3).
 */
export const listTicketsQuerySchema = z.object({
  page: intFromQuery(1),
  pageSize: z
    .string()
    .optional()
    .transform((value) => (value === undefined ? 20 : Number(value)))
    .pipe(z.number().int().min(1).max(100)),
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  category: z.nativeEnum(TicketCategory).optional(),
  assignedToId: z.string().min(1).optional(),
  overdue: booleanFromQuery.optional(),
});

export type ListTicketsQueryDto = z.infer<typeof listTicketsQuerySchema>;
