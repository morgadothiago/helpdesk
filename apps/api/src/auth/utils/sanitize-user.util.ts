import { User } from '@prisma/client';
import { SanitizedUser } from '../types/sanitized-user.type';

/**
 * Remove `password` (e demais campos sensíveis/fora de escopo desta SPEC,
 * como `emailVerified`/`image`) do objeto `User` do Prisma antes de
 * devolvê-lo em qualquer resposta de API (SPEC-02, seção 7).
 */
export function sanitizeUser(user: User): SanitizedUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
