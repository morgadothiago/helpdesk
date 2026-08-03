import '../jest.setup';
import { PrismaClient, Role, TicketCategory, TicketPriority } from '@prisma/client';

/**
 * Testes de integridade do schema Prisma (SPEC-01, seção 10).
 *
 * Estratégia: Prisma Client real contra o Postgres local de desenvolvimento
 * (mesma instância usada por `prisma migrate dev`), não um Postgres de teste
 * dedicado nem mocks — decisão documentada aqui conforme permitido pela
 * SPEC-01 ("via banco de teste local ou Prisma Client mockado, a critério
 * do dev-backend, desde que documentado"). Cada teste limpa os registros
 * que cria, e a suíte inteira limpa qualquer resíduo com o prefixo
 * `spec01-` antes/depois de rodar, para não conflitar com o seed opcional
 * nem com execuções anteriores.
 */
describe('SPEC-01: Modelagem de dados (integridade via Prisma Client)', () => {
  const prisma = new PrismaClient();
  const emailPrefix = 'spec01-test-';

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

  beforeAll(async () => {
    await prisma.$connect();
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('cria um User com role default CUSTOMER', async () => {
    const user = await prisma.user.create({
      data: {
        name: 'Cliente de Teste',
        email: `${emailPrefix}customer@example.com`,
      },
    });

    expect(user.id).toBeDefined();
    expect(user.role).toBe(Role.CUSTOMER);
    expect(user.email).toBe(`${emailPrefix}customer@example.com`);
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it('rejeita e-mail duplicado (constraint de unicidade)', async () => {
    const email = `${emailPrefix}duplicate@example.com`;
    await prisma.user.create({ data: { email } });

    await expect(prisma.user.create({ data: { email } })).rejects.toThrow();
  });

  it('cria um Ticket vinculado a um User, com category e dueAt calculado a partir da prioridade', async () => {
    const customer = await prisma.user.create({
      data: { email: `${emailPrefix}ticket-owner@example.com`, role: Role.CUSTOMER },
    });

    const createdAt = new Date();
    const slaHours = 8; // HIGH, conforme tabela da seção 3.1 da SPEC-01
    const dueAt = new Date(createdAt.getTime() + slaHours * 60 * 60 * 1000);

    const ticket = await prisma.ticket.create({
      data: {
        title: 'Erro ao emitir nota fiscal',
        description: 'O sistema retorna erro 500 ao tentar emitir a nota.',
        category: TicketCategory.BILLING,
        priority: TicketPriority.HIGH,
        createdById: customer.id,
        dueAt,
        createdAt,
      },
    });

    expect(ticket.id).toBeDefined();
    expect(ticket.createdById).toBe(customer.id);
    expect(ticket.category).toBe(TicketCategory.BILLING);
    expect(ticket.priority).toBe(TicketPriority.HIGH);
    expect(ticket.dueAt).not.toBeNull();
    expect(ticket.dueAt?.getTime()).toBe(dueAt.getTime());
    expect(ticket.assignedToId).toBeNull();
    expect(ticket.status).toBe('OPEN');
  });

  it('exige createdById obrigatório e aceita assignedToId opcional/nullable em Ticket', async () => {
    const customer = await prisma.user.create({
      data: { email: `${emailPrefix}ticket-owner-2@example.com`, role: Role.CUSTOMER },
    });
    const agent = await prisma.user.create({
      data: { email: `${emailPrefix}ticket-agent@example.com`, role: Role.AGENT },
    });

    const ticketWithoutAssignee = await prisma.ticket.create({
      data: {
        title: 'Dúvida geral',
        description: 'Como funciona o plano premium?',
        createdById: customer.id,
      },
    });
    expect(ticketWithoutAssignee.assignedToId).toBeNull();

    const ticketWithAssignee = await prisma.ticket.update({
      where: { id: ticketWithoutAssignee.id },
      data: { assignedToId: agent.id },
    });
    expect(ticketWithAssignee.assignedToId).toBe(agent.id);

    // createdById é obrigatório: criar Ticket sem createdById deve falhar.
    await expect(
      prisma.ticket.create({
        data: {
          title: 'Ticket inválido',
          description: 'Sem criador',
        } as never,
      }),
    ).rejects.toThrow();
  });

  it('cria um Comment vinculado a um Ticket e a um User (author)', async () => {
    const customer = await prisma.user.create({
      data: { email: `${emailPrefix}comment-owner@example.com`, role: Role.CUSTOMER },
    });
    const ticket = await prisma.ticket.create({
      data: {
        title: 'Problema de login',
        description: 'Não recebo o e-mail de verificação.',
        createdById: customer.id,
      },
    });

    const comment = await prisma.comment.create({
      data: {
        content: 'Já verifiquei a caixa de spam, nada chegou.',
        ticketId: ticket.id,
        authorId: customer.id,
      },
    });

    expect(comment.id).toBeDefined();
    expect(comment.ticketId).toBe(ticket.id);
    expect(comment.authorId).toBe(customer.id);
    expect(comment.createdAt).toBeInstanceOf(Date);
  });

  it('cria um Attachment vinculado a um Ticket (sem commentId)', async () => {
    const customer = await prisma.user.create({
      data: { email: `${emailPrefix}attach-ticket-owner@example.com`, role: Role.CUSTOMER },
    });
    const ticket = await prisma.ticket.create({
      data: {
        title: 'Erro com print em anexo',
        description: 'Segue print do erro.',
        createdById: customer.id,
      },
    });

    const attachment = await prisma.attachment.create({
      data: {
        filename: 'erro.png',
        mimeType: 'image/png',
        size: 1024,
        storageKey: 'tickets/erro.png',
        ticketId: ticket.id,
        uploadedById: customer.id,
      },
    });

    expect(attachment.id).toBeDefined();
    expect(attachment.ticketId).toBe(ticket.id);
    expect(attachment.commentId).toBeNull();
    expect(attachment.uploadedById).toBe(customer.id);
  });

  it('cria um Attachment vinculado a um Comment (sem ticketId), separadamente do caso anterior', async () => {
    const customer = await prisma.user.create({
      data: { email: `${emailPrefix}attach-comment-owner@example.com`, role: Role.CUSTOMER },
    });
    const ticket = await prisma.ticket.create({
      data: {
        title: 'Dúvida sobre fatura',
        description: 'Valor cobrado parece incorreto.',
        createdById: customer.id,
      },
    });
    const comment = await prisma.comment.create({
      data: {
        content: 'Segue o comprovante em anexo.',
        ticketId: ticket.id,
        authorId: customer.id,
      },
    });

    const attachment = await prisma.attachment.create({
      data: {
        filename: 'comprovante.pdf',
        mimeType: 'application/pdf',
        size: 2048,
        storageKey: 'comments/comprovante.pdf',
        commentId: comment.id,
        uploadedById: customer.id,
      },
    });

    expect(attachment.id).toBeDefined();
    expect(attachment.commentId).toBe(comment.id);
    expect(attachment.ticketId).toBeNull();
    expect(attachment.uploadedById).toBe(customer.id);
  });

  it('respeita integridade referencial: falha ao criar Ticket com createdById inexistente', async () => {
    await expect(
      prisma.ticket.create({
        data: {
          title: 'Ticket órfão',
          description: 'createdById não existe',
          createdById: 'usuario-inexistente-id',
        },
      }),
    ).rejects.toThrow();
  });

  it('deriva overdue a partir de dueAt e status (sem coluna persistida), conforme seção 3.1', async () => {
    const customer = await prisma.user.create({
      data: { email: `${emailPrefix}overdue-owner@example.com`, role: Role.CUSTOMER },
    });

    const pastDueAt = new Date(Date.now() - 60 * 60 * 1000); // 1h atrás
    const ticket = await prisma.ticket.create({
      data: {
        title: 'Ticket atrasado',
        description: 'Passou do prazo de SLA.',
        createdById: customer.id,
        priority: TicketPriority.URGENT,
        dueAt: pastDueAt,
      },
    });

    // Overdue é calculado pela camada de API (SPEC-03), não persistido aqui.
    // O teste valida que o schema fornece os dados necessários para o cálculo.
    const isOverdue =
      ticket.dueAt !== null &&
      ticket.dueAt.getTime() < Date.now() &&
      ticket.status !== 'RESOLVED' &&
      ticket.status !== 'CLOSED';

    expect(isOverdue).toBe(true);

    const resolvedTicket = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: 'RESOLVED', closedAt: new Date() },
    });

    const isOverdueAfterResolved =
      resolvedTicket.dueAt !== null &&
      resolvedTicket.dueAt.getTime() < Date.now() &&
      resolvedTicket.status !== 'RESOLVED' &&
      resolvedTicket.status !== 'CLOSED';

    expect(isOverdueAfterResolved).toBe(false);
  });
});
