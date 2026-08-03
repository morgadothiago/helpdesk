import '../jest.setup';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { rm } from 'fs/promises';
import { join } from 'path';
import { AppModule } from '../app.module';

interface TicketResponseBody {
  id: string;
  status: string;
}

interface CommentResponseBody {
  id: string;
  content: string;
  authorId: string;
  author: { id: string; name: string | null; role: string };
  attachments: { id: string; downloadUrl: string }[];
  createdAt: string;
}

/**
 * Testes de integração de `CommentsController` (SPEC-04, seção 10), ponta a
 * ponta via HTTP (supertest), mesma estratégia de `tickets/tickets.e2e.spec.ts`
 * (SPEC-03). Cobre RF01–RF09 no nível HTTP.
 */
describe('CommentsController (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient();
  const emailPrefix = 'spec04-test-';

  async function cleanup(): Promise<void> {
    await prisma.attachment.deleteMany({
      where: { uploadedBy: { email: { startsWith: emailPrefix } } },
    });
    await prisma.comment.deleteMany({
      where: { author: { email: { startsWith: emailPrefix } } },
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

  async function makeAgentCookie(email: string): Promise<string> {
    await registerAndLogin(email);
    await prisma.user.update({ where: { email }, data: { role: 'AGENT' } });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'senha-forte-123' })
      .expect(200);
    return (login.headers['set-cookie'] as unknown as string[])[0];
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

  it('RF01: POST /tickets/:id/comments sem sessão retorna 401', async () => {
    await request(app.getHttpServer())
      .post('/tickets/inexistente/comments')
      .send({ content: 'Olá' })
      .expect(401);
  });

  it('RF02: POST em ticket alheio como CUSTOMER retorna 404', async () => {
    const owner = await registerAndLogin(
      `${emailPrefix}rf02-owner@example.com`,
    );
    const other = await registerAndLogin(
      `${emailPrefix}rf02-other@example.com`,
    );

    const created = await owner
      .post('/tickets')
      .send({ title: 'T', description: 'D' })
      .expect(201);
    const ticketId = (created.body as TicketResponseBody).id;

    await other
      .post(`/tickets/${ticketId}/comments`)
      .send({ content: 'Invasor' })
      .expect(404);
  });

  it('RF05: content vazio ou ausente retorna 400', async () => {
    const owner = await registerAndLogin(`${emailPrefix}rf05@example.com`);
    const created = await owner
      .post('/tickets')
      .send({ title: 'T', description: 'D' })
      .expect(201);
    const ticketId = (created.body as TicketResponseBody).id;

    await owner
      .post(`/tickets/${ticketId}/comments`)
      .send({ content: '' })
      .expect(400);
    await owner.post(`/tickets/${ticketId}/comments`).send({}).expect(400);
  });

  it('RF03: POST em ticket CLOSED retorna 400/409 e não cria comentário', async () => {
    const owner = await registerAndLogin(`${emailPrefix}rf03@example.com`);
    const agentCookie = await makeAgentCookie(
      `${emailPrefix}rf03-agent@example.com`,
    );

    const created = await owner
      .post('/tickets')
      .send({ title: 'T', description: 'D' })
      .expect(201);
    const ticketId = (created.body as TicketResponseBody).id;

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

    const blocked = await owner
      .post(`/tickets/${ticketId}/comments`)
      .send({ content: 'Depois de fechado' });
    expect([400, 409]).toContain(blocked.status);

    const list = await owner.get(`/tickets/${ticketId}/comments`).expect(200);
    expect(list.body as CommentResponseBody[]).toHaveLength(0);
  });

  it('RF04: GET lista comentários em ordem cronológica, com autor e anexos', async () => {
    const owner = await registerAndLogin(`${emailPrefix}rf04@example.com`);
    const created = await owner
      .post('/tickets')
      .send({ title: 'T', description: 'D' })
      .expect(201);
    const ticketId = (created.body as TicketResponseBody).id;

    await owner
      .post(`/tickets/${ticketId}/comments`)
      .send({ content: 'Primeiro' })
      .expect(201);
    await owner
      .post(`/tickets/${ticketId}/comments`)
      .send({ content: 'Segundo' })
      .expect(201);

    const list = await owner.get(`/tickets/${ticketId}/comments`).expect(200);
    const comments = list.body as CommentResponseBody[];
    expect(comments).toHaveLength(2);
    expect(comments[0].content).toBe('Primeiro');
    expect(comments[1].content).toBe('Segundo');
    expect(comments[0].author).toHaveProperty('role', 'CUSTOMER');
    expect(comments[0].author).not.toHaveProperty('password');
    expect(comments[0].attachments).toEqual([]);
  });

  it('RF06: upload de anexo em comentário valida tamanho/tipo, é atômico e RF07 respeita visibilidade', async () => {
    const owner = await registerAndLogin(`${emailPrefix}rf06@example.com`);
    const other = await registerAndLogin(
      `${emailPrefix}rf06-other@example.com`,
    );

    const created = await owner
      .post('/tickets')
      .send({ title: 'T', description: 'D' })
      .expect(201);
    const ticketId = (created.body as TicketResponseBody).id;

    // Tipo não permitido: nem comentário nem anexo são criados.
    await owner
      .post(`/tickets/${ticketId}/comments`)
      .field('content', 'Com anexo ruim')
      .attach('files[]', Buffer.from('conteudo'), {
        filename: 'malware.exe',
        contentType: 'application/x-msdownload',
      })
      .expect(400);

    const listAfterInvalid = await owner
      .get(`/tickets/${ticketId}/comments`)
      .expect(200);
    expect(listAfterInvalid.body as CommentResponseBody[]).toHaveLength(0);

    // Upload válido.
    const withAttachment = await owner
      .post(`/tickets/${ticketId}/comments`)
      .field('content', 'Com anexo bom')
      .attach('files[]', Buffer.from('conteudo pequeno'), {
        filename: 'foto.png',
        contentType: 'image/png',
      })
      .expect(201);
    const body = withAttachment.body as CommentResponseBody;
    expect(body.attachments).toHaveLength(1);
    const attachmentId = body.attachments[0].id;

    // RF07: outro CUSTOMER não pode baixar (404).
    await other
      .get(
        `/tickets/${ticketId}/comments/${body.id}/attachments/${attachmentId}/download`,
      )
      .expect(404);

    // Dono consegue baixar.
    const download = await owner
      .get(
        `/tickets/${ticketId}/comments/${body.id}/attachments/${attachmentId}/download`,
      )
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
  });

  it('RF08/RF09 (seção 9): comentar nunca altera Ticket.status', async () => {
    const owner = await registerAndLogin(`${emailPrefix}rf08@example.com`);
    const agentCookie = await makeAgentCookie(
      `${emailPrefix}rf08-agent@example.com`,
    );

    const created = await owner
      .post('/tickets')
      .send({ title: 'T', description: 'D' })
      .expect(201);
    const ticketId = (created.body as TicketResponseBody).id;

    await request(app.getHttpServer())
      .patch(`/tickets/${ticketId}`)
      .set('Cookie', [agentCookie])
      .send({ status: 'IN_PROGRESS' })
      .expect(200);

    // RF08: AGENT comenta em ticket IN_PROGRESS.
    await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/comments`)
      .set('Cookie', [agentCookie])
      .send({ content: 'Comentário do agente' })
      .expect(201);

    const afterAgentComment = await request(app.getHttpServer())
      .get(`/tickets/${ticketId}`)
      .set('Cookie', [agentCookie])
      .expect(200);
    expect((afterAgentComment.body as TicketResponseBody).status).toBe(
      'IN_PROGRESS',
    );

    await request(app.getHttpServer())
      .patch(`/tickets/${ticketId}`)
      .set('Cookie', [agentCookie])
      .send({ status: 'WAITING_CUSTOMER' })
      .expect(200);

    // RF09: CUSTOMER comenta em ticket WAITING_CUSTOMER.
    await owner
      .post(`/tickets/${ticketId}/comments`)
      .send({ content: 'Resposta do cliente' })
      .expect(201);

    const afterCustomerComment = await owner
      .get(`/tickets/${ticketId}`)
      .expect(200);
    expect((afterCustomerComment.body as TicketResponseBody).status).toBe(
      'WAITING_CUSTOMER',
    );
  });
});
