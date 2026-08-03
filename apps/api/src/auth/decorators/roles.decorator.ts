import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Marca uma rota com os papéis autorizados a acessá-la. Deve ser combinado
 * com `RolesGuard` (e, tipicamente, `JwtAuthGuard`) — sem `@Roles()`, o
 * `RolesGuard` libera qualquer usuário autenticado (SPEC-02, seção 8).
 *
 * Uso: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('AGENT', 'ADMIN')`.
 */
export const Roles = (...roles: Role[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_KEY, roles);
