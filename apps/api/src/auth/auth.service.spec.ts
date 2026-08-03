import '../jest.setup';
import { ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Testes unitários do AuthService (SPEC-02, seção 10): hashing/validação de
 * senha e regra de email duplicado (RF01), sem depender de rota HTTP.
 * PrismaService é mockado aqui — os fluxos completos via HTTP (incluindo
 * cookie httpOnly) são cobertos por `auth.e2e.spec.ts` contra Postgres real,
 * seguindo a mesma estratégia documentada em `prisma/data-model.spec.ts`
 * (SPEC-01).
 */
describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('signed.jwt.token') },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('cria usuário com senha hasheada (bcrypt) e não retorna a senha (RF01)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: 'user-1',
            name: data.name ?? null,
            email: data.email,
            password: data.password,
            role: Role.CUSTOMER,
            emailVerified: null,
            image: null,
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-01'),
          }),
      );

      const result = await service.register({
        name: 'Cliente Teste',
        email: 'novo@example.com',
        password: 'senha-forte-123',
      });

      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe('novo@example.com');
      expect(result.role).toBe(Role.CUSTOMER);

      const createCalls = prisma.user.create.mock.calls as Array<
        [{ data: Record<string, unknown> }]
      >;
      const createArgs = createCalls[0][0];
      expect(createArgs.data.password).not.toBe('senha-forte-123');
      await expect(
        bcrypt.compare('senha-forte-123', createArgs.data.password as string),
      ).resolves.toBe(true);
    });

    it('rejeita email duplicado com ConflictException (409)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: 'ja-existe@example.com',
      });

      await expect(
        service.register({
          email: 'ja-existe@example.com',
          password: 'senha-forte-123',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('validateUser', () => {
    it('retorna usuário sanitizado quando a senha confere', async () => {
      const passwordHash = await bcrypt.hash('senha-correta', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        name: 'Cliente',
        email: 'cliente@example.com',
        password: passwordHash,
        role: Role.CUSTOMER,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.validateUser(
        'cliente@example.com',
        'senha-correta',
      );

      expect(result).not.toBeNull();
      expect(result).not.toHaveProperty('password');
      expect(result?.email).toBe('cliente@example.com');
    });

    it('retorna null quando a senha está incorreta', async () => {
      const passwordHash = await bcrypt.hash('senha-correta', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'cliente@example.com',
        password: passwordHash,
        role: Role.CUSTOMER,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.validateUser(
        'cliente@example.com',
        'senha-errada',
      );

      expect(result).toBeNull();
    });

    it('retorna null quando o usuário não existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser(
        'inexistente@example.com',
        'qualquer-senha',
      );

      expect(result).toBeNull();
    });

    it('retorna null quando o usuário existe mas não tem senha definida', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'sem-senha@example.com',
        password: null,
        role: Role.CUSTOMER,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.validateUser(
        'sem-senha@example.com',
        'qualquer-senha',
      );

      expect(result).toBeNull();
    });
  });
});
