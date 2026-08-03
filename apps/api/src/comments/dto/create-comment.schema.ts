import { z } from 'zod';

/**
 * Payload de `POST /tickets/:id/comments` (SPEC-04, seção 3/5): `content`
 * obrigatório (RF05), tamanho máximo razoável (5000 caracteres, mesmo
 * limite de `description` em SPEC-03). `files[]` chega via multipart e é
 * validado separadamente em `CommentsService` (tamanho/tipo, SPEC-01 seção
 * 3.2) — não faz parte deste schema zod.
 */
export const createCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'content é obrigatório.')
    .max(5000, 'content deve ter no máximo 5000 caracteres.'),
});

export type CreateCommentDto = z.infer<typeof createCommentSchema>;
