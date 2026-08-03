import '../jest.setup';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  Attachment,
  Role,
  Ticket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';
import { Readable } from 'stream';
import { SanitizedUser } from '../auth/types/sanitized-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { createTicketSchema } from './dto/create-ticket.schema';
import { listTicketsQuerySchema } from './dto/list-tickets-query.schema';
import { TicketsService } from './tickets.service';

type TicketWriteArgs = { data: Partial<Ticket> };
type TicketFindManyArgs = {
  where?: Record<string, unknown>;
  skip?: number;
  take?: number;
  orderBy?: Record<string, unknown>;
};
type AttachmentWriteArgs = { data: Partial<Attachment> };

/**
 * Testes unitários do `TicketsService` (SPEC-03, seção 10): cobrem os RFs da
 * seção 5 (RF01–RF14) com `PrismaService`/`StorageService` mockados — mesma
 * estratégia documentada em `auth/auth.service.spec.ts` (SPEC-02). Fluxos
 * HTTP completos (guards/serialização) ficam a critério de testes de
 * controller separados; aqui o foco é a regra de negócio: autorização por
 * papel, cálculo de `dueAt`/`overdue` e a máquina de estados restrita
 * (seção 9).
 */
describe('TicketsService', () => {
  let service: TicketsService;
  let prisma: {
    ticket: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    attachment: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
    user: { findUnique: jest.Mock };
  };
  let storage: jest.Mocked<StorageService>;

  const customer: SanitizedUser = {
    id: 'customer-1',
    name: 'Cliente',
    email: 'cliente@example.com',
    role: Role.CUSTOMER,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const otherCustomer: SanitizedUser = { ...customer, id: 'customer-2' };
  const agent: SanitizedUser = {
    id: 'agent-1',
    name: 'Agente',
    email: 'agente@example.com',
    role: Role.AGENT,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const admin: SanitizedUser = { ...agent, id: 'admin-1', role: Role.ADMIN };

  function buildTicket(overrides: Partial<Ticket> = {}): Ticket {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    return {
      id: 'ticket-1',
      title: 'Título',
      description: 'Descrição',
      status: TicketStatus.OPEN,
      priority: TicketPriority.MEDIUM,
      category: TicketCategory.GENERAL,
      createdById: customer.id,
      assignedToId: null,
      dueAt: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000),
      createdAt,
      updatedAt: createdAt,
      closedAt: null,
      ...overrides,
    };
  }

  function echoTicketOnWrite(): (args: TicketWriteArgs) => Promise<Ticket> {
    return (args: TicketWriteArgs) => Promise.resolve(buildTicket(args.data));
  }

  beforeEach(() => {
    prisma = {
      ticket: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      attachment: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      user: { findUnique: jest.fn() },
    };
    storage = {
      upload: jest.fn().mockResolvedValue('storage-key-1'),
      getUrl: jest.fn().mockReturnValue('local://storage-key-1'),
      delete: jest.fn().mockResolvedValue(undefined),
      getFileStream: jest.fn(),
    };

    service = new TicketsService(prisma as unknown as PrismaService, storage);
  });

  describe('create (RF01/RF02/RF08)', () => {
    it('define createdById a partir da sessão, status OPEN e dueAt a partir da priority', async () => {
      prisma.ticket.create.mockImplementation(echoTicketOnWrite());

      const dto = createTicketSchema.parse({
        title: 'Erro no sistema',
        description: 'Não consigo logar',
        priority: TicketPriority.HIGH,
      });

      const result = await service.create(customer, dto);

      const createCalls = prisma.ticket.create.mock.calls as [
        TicketWriteArgs,
      ][];
      const createArgs = createCalls[0][0];
      expect(createArgs.data.createdById).toBe(customer.id);
      expect(createArgs.data.status).toBe(TicketStatus.OPEN);
      expect(result.status).toBe(TicketStatus.OPEN);

      const createdAt = createArgs.data.createdAt as Date;
      const dueAt = createArgs.data.dueAt as Date;
      expect(dueAt.getTime()).toBe(createdAt.getTime() + 8 * 60 * 60 * 1000); // HIGH = 8h
    });

    it('RF08: sem category no body usa GENERAL como default (via schema zod)', () => {
      const dto = createTicketSchema.parse({
        title: 'Título',
        description: 'Descrição',
      });
      expect(dto.category).toBe(TicketCategory.GENERAL);
      expect(dto.priority).toBe(TicketPriority.MEDIUM);
    });

    it('rejeita title vazio (RF02, validação zod)', () => {
      const result = createTicketSchema.safeParse({
        title: '',
        description: 'Descrição',
      });
      expect(result.success).toBe(false);
    });

    it.each([
      [TicketPriority.URGENT, 4],
      [TicketPriority.HIGH, 8],
      [TicketPriority.MEDIUM, 24],
      [TicketPriority.LOW, 72],
    ])(
      'calcula dueAt coerente com a prioridade %s (%i horas)',
      async (priority, hours) => {
        prisma.ticket.create.mockImplementation(echoTicketOnWrite());
        const dto = createTicketSchema.parse({
          title: 'T',
          description: 'D',
          priority,
        });
        await service.create(customer, dto);

        const createCalls = prisma.ticket.create.mock.calls as [
          TicketWriteArgs,
        ][];
        const createArgs = createCalls[0][0];
        const createdAt = createArgs.data.createdAt as Date;
        const dueAt = createArgs.data.dueAt as Date;
        expect(dueAt.getTime() - createdAt.getTime()).toBe(
          hours * 60 * 60 * 1000,
        );
      },
    );
  });

  describe('findAll (RF03/RF04)', () => {
    it('RF03: CUSTOMER nunca recebe tickets de outro usuário (where sempre restringe createdById)', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      const query = listTicketsQuerySchema.parse({});
      await service.findAll(customer, query);

      const findManyCalls = prisma.ticket.findMany.mock.calls as [
        TicketFindManyArgs,
      ][];
      const whereArg = findManyCalls[0][0].where ?? {};
      expect(whereArg.createdById).toBe(customer.id);
    });

    it('RF04: AGENT filtrando status=OPEN retorna apenas tickets com esse status (where aplicado)', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      const query = listTicketsQuerySchema.parse({ status: TicketStatus.OPEN });
      await service.findAll(agent, query);

      const findManyCalls = prisma.ticket.findMany.mock.calls as [
        TicketFindManyArgs,
      ][];
      const whereArg = findManyCalls[0][0].where ?? {};
      expect(whereArg.status).toBe(TicketStatus.OPEN);
      expect(whereArg.createdById).toBeUndefined();
    });

    it('aceita filtro assignedToId=unassigned traduzindo para null', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      const query = listTicketsQuerySchema.parse({
        assignedToId: 'unassigned',
      });
      await service.findAll(agent, query);

      const findManyCalls = prisma.ticket.findMany.mock.calls as [
        TicketFindManyArgs,
      ][];
      const whereArg = findManyCalls[0][0].where ?? {};
      expect(whereArg.assignedToId).toBeNull();
    });

    it('pagina com page/pageSize (defaults 1/20)', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      const query = listTicketsQuerySchema.parse({});
      await service.findAll(agent, query);

      const findManyCalls = prisma.ticket.findMany.mock.calls as [
        TicketFindManyArgs,
      ][];
      const findManyArgs = findManyCalls[0][0];
      expect(findManyArgs.skip).toBe(0);
      expect(findManyArgs.take).toBe(20);
      expect(findManyArgs.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('filtra por overdue (derivado, em memória) e pagina o resultado filtrado', async () => {
      const overdueTicket = buildTicket({
        id: 'overdue-1',
        dueAt: new Date(Date.now() - 60 * 60 * 1000),
        status: TicketStatus.OPEN,
      });
      const onTimeTicket = buildTicket({
        id: 'on-time-1',
        dueAt: new Date(Date.now() + 60 * 60 * 1000),
        status: TicketStatus.OPEN,
      });
      prisma.ticket.findMany.mockResolvedValue([overdueTicket, onTimeTicket]);

      const query = listTicketsQuerySchema.parse({ overdue: 'true' });
      const result = await service.findAll(agent, query);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('overdue-1');
      expect(result.total).toBe(1);
    });
  });

  describe('findOne (RF07/RF09)', () => {
    it('RF07: retorna 404 (NotFoundException) se CUSTOMER acessar ticket de outro usuário', async () => {
      prisma.ticket.findUnique.mockResolvedValue(
        buildTicket({ createdById: otherCustomer.id }),
      );

      await expect(
        service.findOne(customer, 'ticket-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('retorna 404 se o ticket não existir, para qualquer papel', async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);
      await expect(
        service.findOne(agent, 'inexistente'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('AGENT/ADMIN podem ver qualquer ticket', async () => {
      prisma.ticket.findUnique.mockResolvedValue(
        buildTicket({ createdById: otherCustomer.id }),
      );
      prisma.attachment.findMany.mockResolvedValue([]);

      const result = await service.findOne(agent, 'ticket-1');
      expect(result.id).toBe('ticket-1');
    });

    it('RF09: dueAt no passado e status OPEN retorna overdue: true', async () => {
      prisma.ticket.findUnique.mockResolvedValue(
        buildTicket({
          dueAt: new Date(Date.now() - 1000),
          status: TicketStatus.OPEN,
        }),
      );
      prisma.attachment.findMany.mockResolvedValue([]);

      const result = await service.findOne(customer, 'ticket-1');
      expect(result.overdue).toBe(true);
    });

    it('RF09: ticket RESOLVED com closedAt <= dueAt retorna overdue: false', async () => {
      const dueAt = new Date('2026-01-02T00:00:00.000Z');
      prisma.ticket.findUnique.mockResolvedValue(
        buildTicket({
          status: TicketStatus.RESOLVED,
          dueAt,
          closedAt: new Date(dueAt.getTime() - 1000),
        }),
      );
      prisma.attachment.findMany.mockResolvedValue([]);

      const result = await service.findOne(customer, 'ticket-1');
      expect(result.overdue).toBe(false);
    });

    it('RF09: ticket RESOLVED com closedAt > dueAt retorna overdue: true', async () => {
      const dueAt = new Date('2026-01-02T00:00:00.000Z');
      prisma.ticket.findUnique.mockResolvedValue(
        buildTicket({
          status: TicketStatus.RESOLVED,
          dueAt,
          closedAt: new Date(dueAt.getTime() + 1000),
        }),
      );
      prisma.attachment.findMany.mockResolvedValue([]);

      const result = await service.findOne(customer, 'ticket-1');
      expect(result.overdue).toBe(true);
    });

    it('inclui anexos (metadados + downloadUrl) na resposta de detalhe', async () => {
      prisma.ticket.findUnique.mockResolvedValue(buildTicket());
      const attachment: Attachment = {
        id: 'att-1',
        filename: 'a.png',
        mimeType: 'image/png',
        size: 100,
        storageKey: 'k',
        ticketId: 'ticket-1',
        commentId: null,
        uploadedById: customer.id,
        createdAt: new Date(),
      };
      prisma.attachment.findMany.mockResolvedValue([attachment]);

      const result = await service.findOne(customer, 'ticket-1');
      expect(result.attachments).toHaveLength(1);
      expect(result.attachments?.[0].downloadUrl).toBe(
        '/tickets/ticket-1/attachments/att-1/download',
      );
    });
  });

  describe('update — autorização por papel (RF05/RF06)', () => {
    it('RF05: CUSTOMER tentando mudar status retorna 403 (ForbiddenException)', async () => {
      prisma.ticket.findUnique.mockResolvedValue(buildTicket());

      await expect(
        service.update(customer, 'ticket-1', {
          status: TicketStatus.IN_PROGRESS,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.ticket.update).not.toHaveBeenCalled();
    });

    it('CUSTOMER pode atualizar title/description do próprio ticket OPEN', async () => {
      prisma.ticket.findUnique.mockResolvedValue(buildTicket());
      prisma.ticket.update.mockImplementation(echoTicketOnWrite());

      const result = await service.update(customer, 'ticket-1', {
        title: 'Novo título',
      });
      expect(result.title).toBe('Novo título');
    });

    it('CUSTOMER não pode atualizar ticket que não é OPEN, mesmo title/description', async () => {
      prisma.ticket.findUnique.mockResolvedValue(
        buildTicket({ status: TicketStatus.IN_PROGRESS }),
      );

      await expect(
        service.update(customer, 'ticket-1', { title: 'Novo título' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('CUSTOMER não pode atualizar ticket de outro usuário (404)', async () => {
      prisma.ticket.findUnique.mockResolvedValue(
        buildTicket({ createdById: otherCustomer.id }),
      );

      await expect(
        service.update(customer, 'ticket-1', { title: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('AGENT/ADMIN não podem alterar title/description (fora dos campos permitidos)', async () => {
      prisma.ticket.findUnique.mockResolvedValue(buildTicket());

      await expect(
        service.update(agent, 'ticket-1', { title: 'Novo título' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('RF06: AGENT mudando status para RESOLVED seta closedAt', async () => {
      prisma.ticket.findUnique.mockResolvedValue(
        buildTicket({ status: TicketStatus.IN_PROGRESS }),
      );
      prisma.ticket.update.mockImplementation((args: TicketWriteArgs) =>
        Promise.resolve(
          buildTicket({ status: TicketStatus.IN_PROGRESS, ...args.data }),
        ),
      );

      const result = await service.update(agent, 'ticket-1', {
        status: TicketStatus.RESOLVED,
      });

      const updateCalls = prisma.ticket.update.mock.calls as [
        TicketWriteArgs,
      ][];
      const updateArgs = updateCalls[0][0];
      expect(updateArgs.data.status).toBe(TicketStatus.RESOLVED);
      expect(updateArgs.data.closedAt).toBeInstanceOf(Date);
      expect(result.status).toBe(TicketStatus.RESOLVED);
    });

    it('reabrir (RESOLVED -> OPEN) limpa closedAt', async () => {
      prisma.ticket.findUnique.mockResolvedValue(
        buildTicket({ status: TicketStatus.RESOLVED, closedAt: new Date() }),
      );
      prisma.ticket.update.mockImplementation(echoTicketOnWrite());

      await service.update(agent, 'ticket-1', { status: TicketStatus.OPEN });

      const updateCalls = prisma.ticket.update.mock.calls as [
        TicketWriteArgs,
      ][];
      expect(updateCalls[0][0].data.closedAt).toBeNull();
    });

    it('recalcula dueAt a partir do createdAt original ao mudar priority (não do momento da mudança)', async () => {
      const createdAt = new Date('2026-01-01T00:00:00.000Z');
      prisma.ticket.findUnique.mockResolvedValue(
        buildTicket({ createdAt, priority: TicketPriority.MEDIUM }),
      );
      prisma.ticket.update.mockImplementation(echoTicketOnWrite());

      await service.update(agent, 'ticket-1', {
        priority: TicketPriority.URGENT,
      });

      const updateCalls = prisma.ticket.update.mock.calls as [
        TicketWriteArgs,
      ][];
      const dueAt = updateCalls[0][0].data.dueAt as Date;
      expect(dueAt.getTime()).toBe(createdAt.getTime() + 4 * 60 * 60 * 1000);
    });

    it('valida assignedToId contra usuários existentes (400 se inexistente)', async () => {
      prisma.ticket.findUnique.mockResolvedValue(buildTicket());
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update(agent, 'ticket-1', { assignedToId: 'nao-existe' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('máquina de estados restrita (SPEC-03, seção 9)', () => {
    const validTransitions: [TicketStatus, TicketStatus][] = [
      [TicketStatus.OPEN, TicketStatus.IN_PROGRESS],
      [TicketStatus.IN_PROGRESS, TicketStatus.WAITING_CUSTOMER],
      [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED],
      [TicketStatus.WAITING_CUSTOMER, TicketStatus.IN_PROGRESS],
      [TicketStatus.WAITING_CUSTOMER, TicketStatus.RESOLVED],
      [TicketStatus.RESOLVED, TicketStatus.CLOSED],
      [TicketStatus.RESOLVED, TicketStatus.OPEN],
      [TicketStatus.RESOLVED, TicketStatus.IN_PROGRESS],
      [TicketStatus.CLOSED, TicketStatus.OPEN],
      [TicketStatus.CLOSED, TicketStatus.IN_PROGRESS],
    ];

    it.each(validTransitions)('aceita a transição %s -> %s', (from, to) => {
      expect(() => service.assertValidTransition(from, to)).not.toThrow();
    });

    it('RF13: rejeita OPEN -> CLOSED direto com ConflictException (400/409)', () => {
      expect(() =>
        service.assertValidTransition(TicketStatus.OPEN, TicketStatus.CLOSED),
      ).toThrow(ConflictException);
    });

    it('rejeita OPEN -> RESOLVED direto', () => {
      expect(() =>
        service.assertValidTransition(TicketStatus.OPEN, TicketStatus.RESOLVED),
      ).toThrow(ConflictException);
    });

    it('rejeita CLOSED -> RESOLVED', () => {
      expect(() =>
        service.assertValidTransition(
          TicketStatus.CLOSED,
          TicketStatus.RESOLVED,
        ),
      ).toThrow(ConflictException);
    });

    it('RF13: PATCH de OPEN para CLOSED via update() é rejeitado', async () => {
      prisma.ticket.findUnique.mockResolvedValue(
        buildTicket({ status: TicketStatus.OPEN }),
      );

      await expect(
        service.update(agent, 'ticket-1', { status: TicketStatus.CLOSED }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('RF14: PATCH de RESOLVED para OPEN via update() é aceito', async () => {
      prisma.ticket.findUnique.mockResolvedValue(
        buildTicket({ status: TicketStatus.RESOLVED }),
      );
      prisma.ticket.update.mockImplementation(echoTicketOnWrite());

      const result = await service.update(agent, 'ticket-1', {
        status: TicketStatus.OPEN,
      });
      expect(result.status).toBe(TicketStatus.OPEN);
    });
  });

  describe('anexos (RF10/RF11/RF12)', () => {
    const validFile = {
      buffer: Buffer.from('conteudo'),
      originalname: 'foto.png',
      mimetype: 'image/png',
      size: 1024,
    };

    it('RF10: arquivo acima do limite de tamanho retorna 400', async () => {
      prisma.ticket.findUnique.mockResolvedValue(buildTicket());

      await expect(
        service.addAttachment(customer, 'ticket-1', {
          ...validFile,
          size: 11 * 1024 * 1024,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('RF10: tipo não permitido retorna 400', async () => {
      prisma.ticket.findUnique.mockResolvedValue(buildTicket());

      await expect(
        service.addAttachment(customer, 'ticket-1', {
          ...validFile,
          mimetype: 'application/x-msdownload',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('RF11: upload em ticket CLOSED retorna 409', async () => {
      prisma.ticket.findUnique.mockResolvedValue(
        buildTicket({ status: TicketStatus.CLOSED }),
      );

      await expect(
        service.addAttachment(customer, 'ticket-1', validFile),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('CUSTOMER não pode anexar em ticket de outro usuário (404)', async () => {
      prisma.ticket.findUnique.mockResolvedValue(
        buildTicket({ createdById: otherCustomer.id }),
      );

      await expect(
        service.addAttachment(customer, 'ticket-1', validFile),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('faz upload válido e persiste metadados do Attachment', async () => {
      prisma.ticket.findUnique.mockResolvedValue(buildTicket());
      prisma.attachment.create.mockImplementation((args: AttachmentWriteArgs) =>
        Promise.resolve({
          id: 'att-1',
          createdAt: new Date(),
          ...args.data,
        } as Attachment),
      );

      const result = await service.addAttachment(
        customer,
        'ticket-1',
        validFile,
      );

      expect(storage.upload).toHaveBeenCalledWith({
        buffer: validFile.buffer,
        originalName: validFile.originalname,
        mimeType: validFile.mimetype,
      });
      expect(result.filename).toBe('foto.png');
      expect(result.downloadUrl).toBe(
        '/tickets/ticket-1/attachments/att-1/download',
      );
    });

    it('RF12: download de anexo de ticket de outro CUSTOMER retorna 404', async () => {
      prisma.ticket.findUnique.mockResolvedValue(
        buildTicket({ createdById: otherCustomer.id }),
      );

      await expect(
        service.getAttachmentForDownload(customer, 'ticket-1', 'att-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.getFileStream).not.toHaveBeenCalled();
    });

    it('retorna 404 se o anexo não pertencer ao ticket informado', async () => {
      prisma.ticket.findUnique.mockResolvedValue(buildTicket());
      prisma.attachment.findUnique.mockResolvedValue({
        id: 'att-1',
        ticketId: 'outro-ticket',
      });

      await expect(
        service.getAttachmentForDownload(customer, 'ticket-1', 'att-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('faz o download quando o ticket é visível e o anexo pertence a ele', async () => {
      prisma.ticket.findUnique.mockResolvedValue(buildTicket());
      prisma.attachment.findUnique.mockResolvedValue({
        id: 'att-1',
        ticketId: 'ticket-1',
        storageKey: 'storage-key-1',
        mimeType: 'image/png',
        filename: 'foto.png',
      });
      const fakeStream = new Readable();
      storage.getFileStream.mockResolvedValue(fakeStream);

      const result = await service.getAttachmentForDownload(
        customer,
        'ticket-1',
        'att-1',
      );
      expect(result.stream).toBe(fakeStream);
      expect(storage.getFileStream).toHaveBeenCalledWith('storage-key-1');
    });

    it('lista anexos respeitando a mesma regra de visibilidade do ticket', async () => {
      prisma.ticket.findUnique.mockResolvedValue(
        buildTicket({ createdById: otherCustomer.id }),
      );

      await expect(
        service.listAttachments(customer, 'ticket-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  it('não trata AGENT e ADMIN de forma diferente para as regras de campo do PATCH', async () => {
    prisma.ticket.findUnique.mockResolvedValue(
      buildTicket({ status: TicketStatus.IN_PROGRESS }),
    );
    prisma.ticket.update.mockImplementation(echoTicketOnWrite());

    const result = await service.update(admin, 'ticket-1', {
      status: TicketStatus.RESOLVED,
    });
    expect(result.status).toBe(TicketStatus.RESOLVED);
  });
});
