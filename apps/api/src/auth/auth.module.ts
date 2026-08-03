import { Module } from '@nestjs/common';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          // Redundante com a checagem de `main.ts` (SPEC-02, seção 7), mas
          // garante que o módulo nunca assina/valida token sem segredo,
          // mesmo se instanciado fora do bootstrap normal (ex.: testes).
          throw new Error('JWT_SECRET não configurado.');
        }
        const expiresIn = (process.env.JWT_EXPIRES_IN ??
          '1d') as JwtSignOptions['expiresIn'];
        return {
          secret,
          signOptions: { expiresIn },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
