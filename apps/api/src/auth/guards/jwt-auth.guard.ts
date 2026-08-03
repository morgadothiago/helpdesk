import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard reutilizável por toda a API (SPEC-02, seção 8) para proteger rotas
 * que exigem usuário autenticado via JWT (cookie httpOnly). Usado sozinho
 * (RF03) ou combinado com `RolesGuard`/`@Roles()` (RF04) nas SPECs de API
 * seguintes (03, 04).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(err: unknown, user: TUser | false): TUser {
    if (err || !user) {
      throw err instanceof Error ? err : new UnauthorizedException();
    }
    return user;
  }
}
