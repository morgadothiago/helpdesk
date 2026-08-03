import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import { SanitizedUser } from '../types/sanitized-user.type';

/**
 * Estratégia de login por email/senha (RF02), usada por `POST /auth/login`
 * através do `LocalAuthGuard` (SPEC-02, seção 3).
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'email', passwordField: 'password' });
  }

  async validate(email: string, password: string): Promise<SanitizedUser> {
    const user = await this.authService.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    return user;
  }
}
