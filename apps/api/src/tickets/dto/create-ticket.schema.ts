import { TicketCategory, TicketPriority } from '@prisma/client';
import { z } from 'zod';

/**
 * `POST /tickets` (SPEC-03, seção 3/7): `createdById`/`status`/`dueAt` nunca
 * vêm do body — sempre calculados/atribuídos no service a partir da sessão.
 */
export const createTicketSchema = z.object({
  title: z.string().trim().min(1, 'title é obrigatório.').max(200),
  description: z.string().trim().min(1, 'description é obrigatório.').max(5000),
  priority: z
    .nativeEnum(TicketPriority)
    .optional()
    .default(TicketPriority.MEDIUM),
  category: z
    .nativeEnum(TicketCategory)
    .optional()
    .default(TicketCategory.GENERAL),
});

export type CreateTicketDto = z.infer<typeof createTicketSchema>;
