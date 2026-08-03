import { Role } from '@prisma/client';

/**
 * Formato de usuário retornado por qualquer resposta de API do AuthModule.
 * Nunca inclui `password` (SPEC-02, seção 7: "nenhuma informação sensível
 * deve vazar").
 */
export interface SanitizedUser {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}
