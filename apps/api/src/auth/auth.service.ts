import { ConflictException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './types/jwt-payload.type';
import { SanitizedUser } from './types/sanitized-user.type';
import { sanitizeUser } from './utils/sanitize-user.util';
import { BCRYPT_SALT_ROUNDS } from './constants';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * RF01: cria um `User` com senha hasheada (bcrypt) e `role: CUSTOMER`
   * (default do schema). Lança 409 se o email já existir.
   */
  async register(dto: RegisterDto): Promise<SanitizedUser> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Este email já está cadastrado.');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: passwordHash,
      },
    });

    return sanitizeUser(user);
  }

  /**
   * Usado pela `LocalStrategy` (RF02). Retorna o usuário sanitizado se as
   * credenciais forem válidas, `null` caso contrário (email inexistente,
   * usuário sem senha definida, ou senha incorreta).
   */
  async validateUser(
    email: string,
    password: string,
  ): Promise<SanitizedUser | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return null;
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return null;
    }

    return sanitizeUser(user);
  }

  /**
   * Assina o JWT (`sub` + `role`) que será colocado no cookie httpOnly pelo
   * controller (RF02).
   */
  signAccessToken(user: SanitizedUser): string {
    const payload: JwtPayload = { sub: user.id, role: user.role };
    return this.jwtService.sign(payload);
  }
}
