import '../jest.setup';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  Role,
  TicketStatus,
  TicketPriority,
  TicketCategory,
} from '@prisma/client';
import { Readable } from 'stream';
import { SanitizedUser } from '../auth/types/sanitized-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  TicketsService,
  UploadAttachmentInput,
} from '../tickets/tickets.service';
import { CommentsService } from './comments.service';
import { createCommentSchema } from './dto/create-comment.schema';

/**
 * Testes unitários do `CommentsService` (SPEC-04, seção 10): cobrem RF01–RF09
 * com `PrismaService`/`TicketsService`/`StorageService` mockados, mesma
 * estratégia de `tickets/tickets.service.spec.ts` (SPEC-03).
 */
describe('CommentsService', () => {
  let service: CommentsService;
  let prisma: {
    comment: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    attachment: {
      createMany: jest.Mock;
      findUnique: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let ticketsService: { getVisibleTicketOrThrow: jest.Mock };
  let storage: jest.Mocked<StorageService>;

  const customer: SanitizedUser = {
    id: 'customer-1',
    name: 'Cliente',
    email: 'cliente@example.com',
    role: Role.CUSTOMER,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const agent: SanitizedUser = {
    id: 'agent-1',
    name: 'Agente',
    email: 'agente@example.com',
    role: Role.AGENT,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function buildTicket(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'ticket-1',
      title: 'Título',
      description: 'Descrição',
      status: TicketStatus.OPEN,
      priority: TicketPriority.MEDIUM,
      category: TicketCategory.GENERAL,
      createdById: customer.id,
      assignedToId: null,
      dueAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      closedAt: null,
      ...overrides,
    };
  }

  const validFile: UploadAttachmentInput = {
    buffer: Buffer.from('conteudo'),
    originalname: 'foto.png',
    mimetype: 'image/png',
    size: 1024,
  };

  beforeEach(() => {
    prisma = {
      comment: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      attachment: {
        createMany: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    ticketsService = {
      getVisibleTicketOrThrow: jest.fn(),
    };
    storage = {
      upload: jest.fn().mockResolvedValue('storage-key-1'),
      getUrl: jest.fn().mockReturnValue('local://storage-key-1'),
      delete: jest.fn().mockResolvedValue(undefined),
      getFileStream: jest.fn(),
    };

    service = new CommentsService(
      prisma as unknown as PrismaService,
      ticketsService as unknown as TicketsService,
      storage,
    );
  });

  describe('create (RF01–RF06/RF08/RF09)', () => {
    it('RF02: 404 se CUSTOMER não puder ver o ticket (delegado ao TicketsService)', async () => {
      ticketsService.getVisibleTicketOrThrow.mockRejectedValue(
        new NotFoundException({
          code: 'TICKET_NOT_FOUND',
          message: 'Ticket não encontrado.',
        }),
      );

      const dto = createCommentSchema.parse({ content: 'Olá' });
      await expect(
        service.create(customer, 'ticket-1', dto, []),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('RF03: ticket CLOSED retorna 409/ConflictException e não cria comentário', async () => {
      ticketsService.getVisibleTicketOrThrow.mockResolvedValue(
        buildTicket({ status: TicketStatus.CLOSED }),
      );

      const dto = createCommentSchema.parse({ content: 'Olá' });
      await expect(
        service.create(customer, 'ticket-1', dto, []),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('RF05: content vazio é rejeitado pelo schema zod', () => {
      const result = createCommentSchema.safeParse({ content: '' });
      expect(result.success).toBe(false);
    });

    it('RF06: arquivo acima do limite de tamanho retorna 400 e nada é persistido/enviado', async () => {
      ticketsService.getVisibleTicketOrThrow.mockResolvedValue(buildTicket());

      const dto = createCommentSchema.parse({ content: 'Olá' });
      await expect(
        service.create(customer, 'ticket-1', dto, [
          { ...validFile, size: 11 * 1024 * 1024 },
        ]),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(storage.upload).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('RF06: tipo de arquivo não permitido retorna 400 e nada é persistido/enviado', async () => {
      ticketsService.getVisibleTicketOrThrow.mockResolvedValue(buildTicket());

      const dto = createCommentSchema.parse({ content: 'Olá' });
      await expect(
        service.create(customer, 'ticket-1', dto, [
          { ...validFile, mimetype: 'application/x-msdownload' },
        ]),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(storage.upload).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('RF06: se um arquivo do lote for inválido, nenhum é enviado ao storage (tudo ou nada)', async () => {
      ticketsService.getVisibleTicketOrThrow.mockResolvedValue(buildTicket());

      const dto = createCommentSchema.parse({ content: 'Olá' });
      await expect(
        service.create(customer, 'ticket-1', dto, [
          validFile,
          { ...validFile, mimetype: 'application/x-msdownload' },
        ]),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('cria comentário sem anexos', async () => {
      ticketsService.getVisibleTicketOrThrow.mockResolvedValue(buildTicket());
      const createdComment = {
        id: 'comment-1',
        content: 'Olá',
        ticketId: 'ticket-1',
        authorId: customer.id,
        createdAt: new Date(),
        author: { id: customer.id, name: customer.name, role: customer.role },
        attachments: [],
      };
      prisma.$transaction.mockImplementation(
        (callback: (tx: unknown) => unknown) => {
          const tx = {
            comment: {
              create: jest.fn().mockResolvedValue({ id: 'comment-1' }),
              findUniqueOrThrow: jest.fn().mockResolvedValue(createdComment),
            },
            attachment: { createMany: jest.fn() },
          };
          return callback(tx);
        },
      );

      const dto = createCommentSchema.parse({ content: 'Olá' });
      const result = await service.create(customer, 'ticket-1', dto, []);

      expect(result.content).toBe('Olá');
      expect(result.author.role).toBe(Role.CUSTOMER);
      expect(result.attachments).toEqual([]);
    });

    it('cria comentário com anexos e monta downloadUrl aninhada em ticket/comment', async () => {
      ticketsService.getVisibleTicketOrThrow.mockResolvedValue(buildTicket());
      const createdComment = {
        id: 'comment-1',
        content: 'Olá',
        ticketId: 'ticket-1',
        authorId: customer.id,
        createdAt: new Date(),
        author: { id: customer.id, name: customer.name, role: customer.role },
        attachments: [
          {
            id: 'att-1',
            filename: 'foto.png',
            mimeType: 'image/png',
            size: 1024,
            uploadedById: customer.id,
            createdAt: new Date(),
          },
        ],
      };
      const attachmentCreateMany = jest.fn();
      prisma.$transaction.mockImplementation(
        (callback: (tx: unknown) => unknown) => {
          const tx = {
            comment: {
              create: jest.fn().mockResolvedValue({ id: 'comment-1' }),
              findUniqueOrThrow: jest.fn().mockResolvedValue(createdComment),
            },
            attachment: { createMany: attachmentCreateMany },
          };
          return callback(tx);
        },
      );

      const dto = createCommentSchema.parse({ content: 'Olá' });
      const result = await service.create(customer, 'ticket-1', dto, [
        validFile,
      ]);

      expect(storage.upload).toHaveBeenCalledTimes(1);
      expect(attachmentCreateMany).toHaveBeenCalledTimes(1);
      expect(result.attachments[0].downloadUrl).toBe(
        '/tickets/ticket-1/comments/comment-1/attachments/att-1/download',
      );
    });

    it('não chama nenhum método de escrita de status do TicketsService (seção 9)', async () => {
      ticketsService.getVisibleTicketOrThrow.mockResolvedValue(
        buildTicket({ status: TicketStatus.IN_PROGRESS }),
      );
      const createdComment = {
        id: 'comment-1',
        content: 'Olá',
        ticketId: 'ticket-1',
        authorId: agent.id,
        createdAt: new Date(),
        author: { id: agent.id, name: agent.name, role: agent.role },
        attachments: [],
      };
      prisma.$transaction.mockImplementation(
        (callback: (tx: unknown) => unknown) => {
          const tx = {
            comment: {
              create: jest.fn().mockResolvedValue({ id: 'comment-1' }),
              findUniqueOrThrow: jest.fn().mockResolvedValue(createdComment),
            },
            attachment: { createMany: jest.fn() },
          };
          return callback(tx);
        },
      );

      const dto = createCommentSchema.parse({
        content: 'Comentário do agente',
      });
      await service.create(agent, 'ticket-1', dto, []);

      // RF08/seção 9: TicketsService só foi chamado para a checagem de
      // visibilidade — nenhum método de update/transição de status existe
      // no mock, portanto nenhuma chamada além de getVisibleTicketOrThrow é
      // sequer possível de existir aqui.
      expect(ticketsService.getVisibleTicketOrThrow).toHaveBeenCalledTimes(1);
      expect(Object.keys(ticketsService)).toEqual(['getVisibleTicketOrThrow']);
    });
  });

  describe('findAll (RF04)', () => {
    it('lista comentários ordenados por createdAt asc, com autor e anexos', async () => {
      ticketsService.getVisibleTicketOrThrow.mockResolvedValue(buildTicket());
      prisma.comment.findMany.mockResolvedValue([
        {
          id: 'comment-1',
          content: 'Primeiro',
          ticketId: 'ticket-1',
          authorId: customer.id,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          author: { id: customer.id, name: 'Cliente', role: Role.CUSTOMER },
          attachments: [],
        },
      ]);

      const result = await service.findAll(customer, 'ticket-1');

      const findManyCalls = prisma.comment.findMany.mock.calls as [
        { where: Record<string, unknown>; orderBy: Record<string, unknown> },
      ][];
      expect(findManyCalls[0][0].where).toEqual({ ticketId: 'ticket-1' });
      expect(findManyCalls[0][0].orderBy).toEqual({ createdAt: 'asc' });
      expect(result[0].author).toEqual({
        id: customer.id,
        name: 'Cliente',
        role: Role.CUSTOMER,
      });
    });

    it('RF02: 404 se CUSTOMER acessar comentários de ticket alheio', async () => {
      ticketsService.getVisibleTicketOrThrow.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(
        service.findAll(customer, 'ticket-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getAttachmentForDownload (RF07)', () => {
    it('404 se anexo não pertencer ao comentário/ticket informados', async () => {
      ticketsService.getVisibleTicketOrThrow.mockResolvedValue(buildTicket());
      prisma.attachment.findUnique.mockResolvedValue({
        id: 'att-1',
        commentId: 'outro-comment',
        comment: { ticketId: 'ticket-1' },
      });

      await expect(
        service.getAttachmentForDownload(
          customer,
          'ticket-1',
          'comment-1',
          'att-1',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404 se CUSTOMER não puder ver o ticket', async () => {
      ticketsService.getVisibleTicketOrThrow.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(
        service.getAttachmentForDownload(
          customer,
          'ticket-1',
          'comment-1',
          'att-1',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.getFileStream).not.toHaveBeenCalled();
    });

    it('faz o download quando o anexo pertence ao comentário/ticket informados', async () => {
      ticketsService.getVisibleTicketOrThrow.mockResolvedValue(buildTicket());
      prisma.attachment.findUnique.mockResolvedValue({
        id: 'att-1',
        commentId: 'comment-1',
        storageKey: 'storage-key-1',
        mimeType: 'image/png',
        filename: 'foto.png',
        comment: { ticketId: 'ticket-1' },
      });
      const fakeStream = new Readable();
      storage.getFileStream.mockResolvedValue(fakeStream);

      const result = await service.getAttachmentForDownload(
        customer,
        'ticket-1',
        'comment-1',
        'att-1',
      );
      expect(result.stream).toBe(fakeStream);
      expect(storage.getFileStream).toHaveBeenCalledWith('storage-key-1');
    });
  });
});
