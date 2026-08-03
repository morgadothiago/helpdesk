import '../jest.setup';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../app.module';
import { ACCESS_TOKEN_COOKIE } from './constants';

/**
 * Testes de integração do AuthModule (SPEC-02, seção 10), ponta a ponta via
 * HTTP (supertest) contra a aplicação Nest real e o Postgres local de
 * desenvolvimento — mesma estratégia documentada em
 * `src/prisma/data-model.spec.ts` (SPEC-01): banco real, sem mocks, cada
 * teste limpa os registros que cria com o prefixo `spec02-`.
 *
 * Cobre: registro (RF01), login com sucesso/falha + cookie httpOnly (RF02),
 * /auth/me autenticado/não autenticado (RF03), logout idempotente (RF05).
 */
describe('AuthModule (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient();
  const emailPrefix = 'spec02-test-';

  async function cleanup(): Promise<void> {
    await prisma.user.deleteMany({
      where: { email: { startsWith: emailPrefix } },
    });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    await prisma.$connect();
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /auth/register (RF01)', () => {
    it('cria usuário com senha hasheada e retorna dados sem senha', async () => {
      const email = `${emailPrefix}register@example.com`;

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ name: 'Cliente Teste', email, password: 'senha-forte-123' })
        .expect(201);

      expect(response.body).toMatchObject({
        email,
        name: 'Cliente Teste',
        role: 'CUSTOMER',
      });
      expect(response.body).not.toHaveProperty('password');

      const stored = await prisma.user.findUnique({ where: { email } });
      expect(stored?.password).toBeDefined();
      expect(stored?.password).not.toBe('senha-forte-123');
    });

    it('rejeita email duplicado com 409', async () => {
      const email = `${emailPrefix}duplicado@example.com`;
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'senha-forte-123' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'outra-senha-123' })
        .expect(409);
    });
  });

  describe('POST /auth/login (RF02)', () => {
    const email = `${emailPrefix}login@example.com`;
    const password = 'senha-forte-123';

    beforeAll(async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password });
    });

    it('com credenciais válidas retorna 200, dados sem senha e Set-Cookie httpOnly', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200);

      expect(response.body).toMatchObject({ email, role: 'CUSTOMER' });
      expect(response.body).not.toHaveProperty('password');

      const setCookie = response.headers['set-cookie'] as unknown as
        string[] | string;
      expect(setCookie).toBeDefined();
      const cookieHeader: string = Array.isArray(setCookie)
        ? setCookie[0]
        : setCookie;
      expect(cookieHeader).toContain(`${ACCESS_TOKEN_COOKIE}=`);
      expect(cookieHeader.toLowerCase()).toContain('httponly');
    });

    it('com credenciais inválidas retorna 401', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'senha-errada' })
        .expect(401);
    });

    it('com email inexistente retorna 401', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `${emailPrefix}nao-existe@example.com`, password })
        .expect(401);
    });
  });

  describe('GET /auth/me (RF03)', () => {
    const email = `${emailPrefix}me@example.com`;
    const password = 'senha-forte-123';

    beforeAll(async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password });
    });

    it('sem cookie retorna 401', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('com cookie inválido retorna 401', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', [`${ACCESS_TOKEN_COOKIE}=token-invalido`])
        .expect(401);
    });

    it('com cookie válido (agent persistindo sessão do login) retorna os dados do usuário', async () => {
      const agent = request.agent(app.getHttpServer());
      await agent.post('/auth/login').send({ email, password }).expect(200);

      const response = await agent.get('/auth/me').expect(200);

      expect(response.body).toMatchObject({ email, role: 'CUSTOMER' });
      expect(response.body).toHaveProperty('id');
      expect(response.body).not.toHaveProperty('password');
    });
  });

  describe('POST /auth/logout (RF05)', () => {
    const email = `${emailPrefix}logout@example.com`;
    const password = 'senha-forte-123';

    beforeAll(async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password });
    });

    it('limpa o cookie de sessão e é idempotente', async () => {
      const agent = request.agent(app.getHttpServer());
      await agent.post('/auth/login').send({ email, password }).expect(200);
      await agent.get('/auth/me').expect(200);

      await agent.post('/auth/logout').expect(200);
      await agent.get('/auth/me').expect(401);

      // Idempotente: chamar logout de novo (sem sessão ativa) continua 200.
      await agent.post('/auth/logout').expect(200);
    });

    it('chamar logout sem nunca ter feito login também retorna 200 (idempotente)', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(200);
    });
  });
});
