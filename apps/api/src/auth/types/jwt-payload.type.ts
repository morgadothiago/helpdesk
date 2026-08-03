import { Role } from '@prisma/client';

/** Payload assinado dentro do JWT emitido por `POST /auth/login` (SPEC-02, seção 3). */
export interface JwtPayload {
  /** id do usuário (`User.id`). */
  sub: string;
  role: Role;
}
