import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { ACCESS_TOKEN_COOKIE } from '../constants';
import { JwtPayload } from '../types/jwt-payload.type';
import { SanitizedUser } from '../types/sanitized-user.type';
import { sanitizeUser } from '../utils/sanitize-user.util';

/**
 * Extrai o JWT do cookie httpOnly setado por `POST /auth/login`
 * (SPEC-02, seção 3) — nenhum outro mecanismo de transporte é suportado.
 */
function cookieExtractor(req: Request): string | null {
  const cookies = req.cookies as Record<string, string> | undefined;
  const token = cookies?.[ACCESS_TOKEN_COOKIE];
  return token ?? null;
}

/**
 * Valida o JWT em toda rota protegida via `@UseGuards(JwtAuthGuard)`
 * (RF03/RF04).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      // Defesa em profundidade: `main.ts` já valida isso na inicialização
      // (SPEC-02, seção 7), mas o módulo não deve subir sem o segredo de
      // qualquer forma que seja instanciado (ex.: testes).
      throw new Error('JWT_SECRET não configurado.');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<SanitizedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return sanitizeUser(user);
  }
}
