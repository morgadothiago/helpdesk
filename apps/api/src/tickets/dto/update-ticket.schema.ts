import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';
import { z } from 'zod';

/**
 * `PATCH /tickets/:id` (SPEC-03, seção 3/7): schema aceita a união de todos
 * os campos possíveis (o que cada papel pode de fato alterar é decidido no
 * `TicketsService`, não aqui — validação de payload é só de forma/tipo).
 */
export const updateTicketSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(5000).optional(),
    status: z.nativeEnum(TicketStatus).optional(),
    priority: z.nativeEnum(TicketPriority).optional(),
    category: z.nativeEnum(TicketCategory).optional(),
    assignedToId: z.string().min(1).nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Corpo da requisição não pode ser vazio.',
  });

export type UpdateTicketDto = z.infer<typeof updateTicketSchema>;
