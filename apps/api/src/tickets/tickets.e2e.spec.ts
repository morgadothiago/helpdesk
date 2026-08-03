import '../jest.setup';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { PrismaClient, TicketPriority, TicketStatus } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { rm } from 'fs/promises';
import { join } from 'path';
import { AppModule } from '../app.module';

interface TicketResponseBody {
  id: string;
  status: string;
  category: string;
  createdAt: string;
  dueAt: string;
  overdue: boolean;
  closedAt: string | null;
}

interface AttachmentResponseBody {
  id: string;
}

/**
 * Testes de integração de `TicketsController` (SPEC-03, seção 10), ponta a
 * ponta via HTTP (supertest) contra a aplicação Nest real e o Postgres local
 * — mesma estratégia de `auth/auth.e2e.spec.ts` (SPEC-02) e
 * `prisma/data-model.spec.ts` (SPEC-01). Cobre RF01–RF14 no nível HTTP:
 * guards (401), validação zod (400), formato de erro padronizado
 * (`{ error: { code, message } }`) e visibilidade por papel.
 */
describe('TicketsController (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient();
  const emailPrefix = 'spec03-test-';

  async function cleanup(): Promise<void> {
    await prisma.attachment.deleteMany({
      where: { uploadedBy: { email: { startsWith: emailPrefix } } },
    });
    await prisma.ticket.deleteMany({
      where: { createdBy: { email: { startsWith: emailPrefix } } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: emailPrefix } },
    });
  }

  async function registerAndLogin(email: string, password = 'senha-forte-123') {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password });
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(200);
    return agent;
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
    await rm(join(process.cwd(), 'uploads'), { recursive: true, force: true });
  });

  it('RF01: POST /tickets sem sessão retorna 401', async () => {
    await request(app.getHttpServer())
      .post('/tickets')
      .send({ title: 'T', description: 'D' })
      .expect(401);
  });

  it('RF02: POST /tickets com title vazio retorna 400 com detalhes de validação', async () => {
    const customer = await registerAndLogin(`${emailPrefix}rf02@example.com`);

    const response = await customer
      .post('/tickets')
      .send({ title: '', description: 'D' })
      .expect(400);

    expect(response.body).toHaveProperty('error.code');
    expect(response.body).toHaveProperty('error.message');
  });

  it('RF08/RF09: cria ticket com category default GENERAL e dueAt coerente com a priority', async () => {
    const customer = await registerAndLogin(`${emailPrefix}rf08@example.com`);

    const response = await customer
      .post('/tickets')
      .send({
        title: 'Erro X',
        description: 'Descrição',
        priority: TicketPriority.URGENT,
      })
      .expect(201);

    const body = response.body as TicketResponseBody;
    expect(body.category).toBe('GENERAL');
    expect(body.status).toBe('OPEN');
    const createdAtMs = new Date(body.createdAt).getTime();
    const dueAtMs = new Date(body.dueAt).getTime();
    expect(dueAtMs - createdAtMs).toBe(4 * 60 * 60 * 1000);
    expect(body.overdue).toBe(false);
  });

  it('RF03/RF07: CUSTOMER só lista/vê os próprios tickets (404 para ticket alheio)', async () => {
    const customerA = await registerAndLogin(
      `${emailPrefix}rf03-a@example.com`,
    );
    const customerB = await registerAndLogin(
      `${emailPrefix}rf03-b@example.com`,
    );

    const created = await customerA
      .post('/tickets')
      .send({ title: 'Ticket A', description: 'D' })
      .expect(201);
    const ticketId = (created.body as TicketResponseBody).id;

    const listA = await customerA.get('/tickets').expect(200);
    const dataA = (listA.body as { data: TicketResponseBody[] }).data;
    expect(dataA.every((t) => t.id !== undefined)).toBe(true);
    expect(dataA.some((t) => t.id === ticketId)).toBe(true);

    const listB = await customerB.get('/tickets').expect(200);
    const dataB = (listB.body as { data: TicketResponseBody[] }).data;
    expect(dataB.some((t) => t.id === ticketId)).toBe(false);

    await customerB.get(`/tickets/${ticketId}`).expect(404);
    await customerA.get(`/tickets/${ticketId}`).expect(200);
  });

  it('RF04: AGENT filtra GET /tickets?status=OPEN', async () => {
    const customer = await registerAndLogin(
      `${emailPrefix}rf04-customer@example.com`,
    );
    const agent = await registerAndLogin(
      `${emailPrefix}rf04-agent@example.com`,
    );
    await prisma.user.update({
      where: { email: `${emailPrefix}rf04-agent@example.com` },
      data: { role: 'AGENT' },
    });
    // Re-login para o JWT refletir o novo papel.
    const agentReloggedResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: `${emailPrefix}rf04-agent@example.com`,
        password: 'senha-forte-123',
      })
      .expect(200);
    const agentCookie = (
      agentReloggedResponse.headers['set-cookie'] as unknown as string[]
    )[0];

    await customer
      .post('/tickets')
      .send({ title: 'Aberto', description: 'D' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/tickets')
      .set('Cookie', [agentCookie])
      .query({ status: TicketStatus.OPEN })
      .expect(200);

    const data = (response.body as { data: TicketResponseBody[] }).data;
    expect(data.every((t) => t.status === TicketStatus.OPEN)).toBe(true);
    void agent;
  });

  it('RF05/RF06/RF13/RF14: autorização por papel + máquina de estados via PATCH', async () => {
    const customer = await registerAndLogin(`${emailPrefix}rf05@example.com`);
    const agentEmail = `${emailPrefix}rf05-agent@example.com`;
    await registerAndLogin(agentEmail);
    await prisma.user.update({
      where: { email: agentEmail },
      data: { role: 'AGENT' },
    });
    const agentLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: agentEmail, password: 'senha-forte-123' })
      .expect(200);
    const agentCookie = (
      agentLogin.headers['set-cookie'] as unknown as string[]
    )[0];

    const created = await customer
      .post('/tickets')
      .send({ title: 'Ticket', description: 'D' })
      .expect(201);
    const ticketId = (created.body as TicketResponseBody).id;

    // RF05: CUSTOMER tentando mudar status -> 403.
    await customer
      .patch(`/tickets/${ticketId}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(403);

    // RF13: AGENT pulando etapas (OPEN -> CLOSED direto) -> 400/409.
    const invalidTransition = await request(app.getHttpServer())
      .patch(`/tickets/${ticketId}`)
      .set('Cookie', [agentCookie])
      .send({ status: 'CLOSED' });
    expect([400, 409]).toContain(invalidTransition.status);

    // Fluxo linear válido: OPEN -> IN_PROGRESS -> RESOLVED.
    await request(app.getHttpServer())
      .patch(`/tickets/${ticketId}`)
      .set('Cookie', [agentCookie])
      .send({ status: 'IN_PROGRESS' })
      .expect(200);

    const resolved = await request(app.getHttpServer())
      .patch(`/tickets/${ticketId}`)
      .set('Cookie', [agentCookie])
      .send({ status: 'RESOLVED' })
      .expect(200);

    // RF06: RESOLVED seta closedAt.
    expect((resolved.body as TicketResponseBody).closedAt).not.toBeNull();

    // RF14: reabertura explícita RESOLVED -> OPEN é aceita.
    const reopened = await request(app.getHttpServer())
      .patch(`/tickets/${ticketId}`)
      .set('Cookie', [agentCookie])
      .send({ status: 'OPEN' })
      .expect(200);
    const reopenedBody = reopened.body as TicketResponseBody;
    expect(reopenedBody.status).toBe('OPEN');
    expect(reopenedBody.closedAt).toBeNull();
  });

  it('RF10/RF11/RF12: upload de anexo valida tipo/tamanho, bloqueia CLOSED e respeita visibilidade', async () => {
    const customer = await registerAndLogin(`${emailPrefix}rf10@example.com`);
    const otherCustomer = await registerAndLogin(
      `${emailPrefix}rf10-other@example.com`,
    );
    const agentEmail = `${emailPrefix}rf10-agent@example.com`;
    await registerAndLogin(agentEmail);
    await prisma.user.update({
      where: { email: agentEmail },
      data: { role: 'AGENT' },
    });
    const agentLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: agentEmail, password: 'senha-forte-123' })
      .expect(200);
    const agentCookie = (
      agentLogin.headers['set-cookie'] as unknown as string[]
    )[0];

    const created = await customer
      .post('/tickets')
      .send({ title: 'Com anexo', description: 'D' })
      .expect(201);
    const ticketId = (created.body as TicketResponseBody).id;

    // RF10: tipo não permitido.
    await customer
      .post(`/tickets/${ticketId}/attachments`)
      .attach('file', Buffer.from('conteudo'), {
        filename: 'malware.exe',
        contentType: 'application/x-msdownload',
      })
      .expect(400);

    // RF10: tamanho acima do limite (10MB).
    await customer
      .post(`/tickets/${ticketId}/attachments`)
      .attach('file', Buffer.alloc(11 * 1024 * 1024, 1), {
        filename: 'grande.png',
        contentType: 'image/png',
      })
      .expect(400);

    // Upload válido.
    const uploaded = await customer
      .post(`/tickets/${ticketId}/attachments`)
      .attach('file', Buffer.from('conteudo pequeno'), {
        filename: 'foto.png',
        contentType: 'image/png',
      })
      .expect(201);
    const attachmentId = (uploaded.body as AttachmentResponseBody).id;

    const list = await customer
      .get(`/tickets/${ticketId}/attachments`)
      .expect(200);
    const attachments = list.body as AttachmentResponseBody[];
    expect(attachments.some((a) => a.id === attachmentId)).toBe(true);

    // RF12: outro CUSTOMER não pode baixar (404).
    await otherCustomer
      .get(`/tickets/${ticketId}/attachments/${attachmentId}/download`)
      .expect(404);

    // Dono consegue baixar.
    const download = await customer
      .get(`/tickets/${ticketId}/attachments/${attachmentId}/download`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect((download.body as Buffer).toString('utf-8')).toBe(
      'conteudo pequeno',
    );

    // RF11: fecha o ticket via fluxo válido e tenta anexar de novo -> 400/409.
    await request(app.getHttpServer())
      .patch(`/tickets/${ticketId}`)
      .set('Cookie', [agentCookie])
      .send({ status: 'IN_PROGRESS' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/tickets/${ticketId}`)
      .set('Cookie', [agentCookie])
      .send({ status: 'RESOLVED' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/tickets/${ticketId}`)
      .set('Cookie', [agentCookie])
      .send({ status: 'CLOSED' })
      .expect(200);

    const blocked = await customer
      .post(`/tickets/${ticketId}/attachments`)
      .attach('file', Buffer.from('outro'), {
        filename: 'outro.png',
        contentType: 'image/png',
      });
    expect([400, 409]).toContain(blocked.status);
  });
});
