import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Attachment, Prisma, Role, Ticket, TicketStatus } from '@prisma/client';
import { Readable } from 'stream';
import { PrismaService } from '../prisma/prisma.service';
import { SanitizedUser } from '../auth/types/sanitized-user.type';
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
  STORAGE_SERVICE,
} from '../storage/storage.constants';
import type { StorageService } from '../storage/storage.service';
import { calculateDueAt } from './constants/sla.constants';
import {
  REOPEN_STATUSES,
  TERMINAL_STATUSES,
  VALID_STATUS_TRANSITIONS,
} from './constants/status-transitions.constants';
import { CreateTicketDto } from './dto/create-ticket.schema';
import { ListTicketsQueryDto } from './dto/list-tickets-query.schema';
import { UpdateTicketDto } from './dto/update-ticket.schema';
import {
  AttachmentResponse,
  TicketResponse,
} from './types/ticket-response.type';
import { isOverdue } from './utils/ticket-overdue.util';

export interface PaginatedTickets {
  data: TicketResponse[];
  page: number;
  pageSize: number;
  total: number;
}

export interface UploadAttachmentInput {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

const CUSTOMER_ALLOWED_FIELDS = new Set<keyof UpdateTicketDto>([
  'title',
  'description',
]);
const AGENT_ALLOWED_FIELDS = new Set<keyof UpdateTicketDto>([
  'status',
  'priority',
  'category',
  'assignedToId',
]);

/**
 * Regras de negócio de tickets (SPEC-03): criação, listagem/filtros/paginação,
 * detalhe, atualização (com autorização por papel e máquina de estados
 * restrita), e anexos (via `StorageService`).
 *
 * `assertValidTransition` é o único ponto de validação da máquina de estados
 * (SPEC-03, seção 6/9) — deve ser reaproveitado por qualquer outro caminho
 * futuro que escreva `Ticket.status` (ex.: gatilho da SPEC-04).
 */
@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  /**
   * RF01/RF02/RF08: `createdById` sempre vem da sessão, `status` inicial é
   * sempre `OPEN`, `dueAt` é calculado a partir de `priority` (nunca
   * recebido do client).
   */
  async create(
    actor: SanitizedUser,
    dto: CreateTicketDto,
  ): Promise<TicketResponse> {
    const createdAt = new Date();
    const dueAt = calculateDueAt(createdAt, dto.priority);

    const ticket = await this.prisma.ticket.create({
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        category: dto.category,
        status: TicketStatus.OPEN,
        createdById: actor.id,
        createdAt,
        dueAt,
      },
    });

    return this.toResponse(ticket);
  }

  /**
   * RF03/RF04: `CUSTOMER` só vê os próprios tickets (aplicado sempre na
   * cláusula `where`, nunca só em memória — SPEC-03 seção 6). `AGENT`/`ADMIN`
   * veem todos, com filtros opcionais. `overdue` é derivado, então é
   * calculado/filtrado após a busca (SPEC-03 seção 3).
   */
  async findAll(
    actor: SanitizedUser,
    query: ListTicketsQueryDto,
  ): Promise<PaginatedTickets> {
    const where: Prisma.TicketWhereInput = {};

    if (actor.role === Role.CUSTOMER) {
      where.createdById = actor.id;
    } else {
      if (query.status) where.status = query.status;
      if (query.priority) where.priority = query.priority;
      if (query.category) where.category = query.category;
      if (query.assignedToId !== undefined) {
        where.assignedToId =
          query.assignedToId === 'unassigned' ? null : query.assignedToId;
      }
    }

    if (query.overdue === undefined) {
      const [rows, total] = await Promise.all([
        this.prisma.ticket.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        this.prisma.ticket.count({ where }),
      ]);
      return {
        data: rows.map((ticket) => this.toResponse(ticket)),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    }

    // `overdue` não é coluna filtrável diretamente (SPEC-01 seção 3.1): busca
    // o conjunto já restrito pelos demais filtros e deriva/filtra em memória.
    const rows = await this.prisma.ticket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    const filtered = rows.filter(
      (ticket) => isOverdue(ticket) === query.overdue,
    );
    const start = (query.page - 1) * query.pageSize;
    const page = filtered.slice(start, start + query.pageSize);

    return {
      data: page.map((ticket) => this.toResponse(ticket)),
      page: query.page,
      pageSize: query.pageSize,
      total: filtered.length,
    };
  }

  /** RF07/RF09: 404 (não 403) se `CUSTOMER` tentar acessar ticket de outro usuário. */
  async findOne(actor: SanitizedUser, id: string): Promise<TicketResponse> {
    const ticket = await this.getTicketOrThrow(id);
    this.assertVisible(actor, ticket);

    const attachments = await this.prisma.attachment.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: 'asc' },
    });

    return this.toResponse(ticket, attachments);
  }

  /**
   * RF05/RF06/RF13/RF14: aplica as regras de campo por papel, recalcula
   * `dueAt` ao mudar `priority` (a partir do `createdAt` original), valida a
   * máquina de estados (seção 9) e gerencia `closedAt`.
   */
  async update(
    actor: SanitizedUser,
    id: string,
    dto: UpdateTicketDto,
  ): Promise<TicketResponse> {
    const ticket = await this.getTicketOrThrow(id);
    this.assertVisible(actor, ticket);

    const data: Prisma.TicketUpdateInput = {};
    const providedFields = Object.keys(dto) as (keyof UpdateTicketDto)[];

    if (actor.role === Role.CUSTOMER) {
      const forbidden = providedFields.filter(
        (field) => !CUSTOMER_ALLOWED_FIELDS.has(field),
      );
      if (forbidden.length > 0) {
        throw new ForbiddenException({
          code: 'FIELD_NOT_ALLOWED',
          message: `Campo(s) não permitido(s) para o papel CUSTOMER: ${forbidden.join(', ')}.`,
        });
      }
      if (ticket.status !== TicketStatus.OPEN) {
        throw new ForbiddenException({
          code: 'TICKET_NOT_EDITABLE',
          message:
            'Só é possível atualizar o ticket enquanto o status for OPEN.',
        });
      }
      if (dto.title !== undefined) data.title = dto.title;
      if (dto.description !== undefined) data.description = dto.description;
    } else {
      const forbidden = providedFields.filter(
        (field) => !AGENT_ALLOWED_FIELDS.has(field),
      );
      if (forbidden.length > 0) {
        throw new ForbiddenException({
          code: 'FIELD_NOT_ALLOWED',
          message: `Campo(s) não permitido(s) para este papel: ${forbidden.join(', ')}.`,
        });
      }

      if (dto.assignedToId !== undefined) {
        if (dto.assignedToId !== null) {
          const assignee = await this.prisma.user.findUnique({
            where: { id: dto.assignedToId },
          });
          if (!assignee) {
            throw new BadRequestException({
              code: 'ASSIGNEE_NOT_FOUND',
              message: 'assignedToId não corresponde a um usuário existente.',
            });
          }
        }
        data.assignedTo =
          dto.assignedToId === null
            ? { disconnect: true }
            : { connect: { id: dto.assignedToId } };
      }

      if (dto.category !== undefined) {
        data.category = dto.category;
      }

      const effectivePriority = dto.priority ?? ticket.priority;
      if (dto.priority !== undefined) {
        data.priority = dto.priority;
        // Recalcula dueAt a partir do createdAt original, nunca do momento
        // da mudança (SPEC-03, seção 3 / SPEC-01, seção 3.1).
        data.dueAt = calculateDueAt(ticket.createdAt, effectivePriority);
      }

      if (dto.status !== undefined && dto.status !== ticket.status) {
        this.assertValidTransition(ticket.status, dto.status);
        data.status = dto.status;
        if (TERMINAL_STATUSES.includes(dto.status)) {
          data.closedAt = new Date();
        } else if (REOPEN_STATUSES.includes(dto.status)) {
          data.closedAt = null;
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return this.toResponse(ticket);
    }

    const updated = await this.prisma.ticket.update({ where: { id }, data });
    return this.toResponse(updated);
  }

  /**
   * Máquina de estados restrita (SPEC-03, seção 9 — CONFIRMED). Único ponto
   * de validação de transição de `Ticket.status` na aplicação (SPEC-03,
   * seção 6): deve ser reaproveitado por qualquer outro caminho que escreva
   * `Ticket.status` (ex.: SPEC-04).
   */
  assertValidTransition(from: TicketStatus, to: TicketStatus): void {
    const allowedTargets = VALID_STATUS_TRANSITIONS[from] ?? [];
    if (!allowedTargets.includes(to)) {
      throw new ConflictException({
        code: 'INVALID_STATUS_TRANSITION',
        message: `Transição de status inválida: ${from} -> ${to}.`,
      });
    }
  }

  /**
   * RF10/RF11: valida tamanho/tipo e bloqueia upload em ticket `CLOSED`,
   * respeitando a visibilidade do ticket.
   */
  async addAttachment(
    actor: SanitizedUser,
    ticketId: string,
    file: UploadAttachmentInput,
  ): Promise<AttachmentResponse> {
    const ticket = await this.getTicketOrThrow(ticketId);
    this.assertVisible(actor, ticket);

    if (ticket.status === TicketStatus.CLOSED) {
      throw new ConflictException({
        code: 'TICKET_CLOSED',
        message: 'Ticket encerrado não recebe novo conteúdo.',
      });
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: `Arquivo excede o limite de ${Math.floor(
          MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024),
        )}MB.`,
      });
    }

    if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException({
        code: 'FILE_TYPE_NOT_ALLOWED',
        message: `Tipo de arquivo não permitido: ${file.mimetype}.`,
      });
    }

    const storageKey = await this.storage.upload({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });

    const attachment = await this.prisma.attachment.create({
      data: {
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storageKey,
        ticketId,
        uploadedById: actor.id,
      },
    });

    return this.toAttachmentResponse(attachment);
  }

  async listAttachments(
    actor: SanitizedUser,
    ticketId: string,
  ): Promise<AttachmentResponse[]> {
    const ticket = await this.getTicketOrThrow(ticketId);
    this.assertVisible(actor, ticket);

    const attachments = await this.prisma.attachment.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    });

    return attachments.map((attachment) =>
      this.toAttachmentResponse(attachment),
    );
  }

  /** RF12: mesma regra de visibilidade do ticket (404 para anexo de ticket alheio). */
  async getAttachmentForDownload(
    actor: SanitizedUser,
    ticketId: string,
    attachmentId: string,
  ): Promise<{ stream: Readable; attachment: Attachment }> {
    const ticket = await this.getTicketOrThrow(ticketId);
    this.assertVisible(actor, ticket);

    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment || attachment.ticketId !== ticketId) {
      throw new NotFoundException({
        code: 'ATTACHMENT_NOT_FOUND',
        message: 'Anexo não encontrado.',
      });
    }

    const stream = await this.storage.getFileStream(attachment.storageKey);
    return { stream, attachment };
  }

  /**
   * Helper compartilhado (SPEC-04, seção 6): busca o ticket e aplica a
   * mesma checagem de visibilidade de `findOne`/`update` (404 para
   * `CUSTOMER` em ticket alheio). Único ponto de leitura reaproveitado por
   * `CommentsService` — não escreve em `Ticket.status` nem expõe nenhum
   * método de transição de status.
   */
  async getVisibleTicketOrThrow(
    actor: SanitizedUser,
    id: string,
  ): Promise<Ticket> {
    const ticket = await this.getTicketOrThrow(id);
    this.assertVisible(actor, ticket);
    return ticket;
  }

  private async getTicketOrThrow(id: string): Promise<Ticket> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      throw new NotFoundException({
        code: 'TICKET_NOT_FOUND',
        message: 'Ticket não encontrado.',
      });
    }
    return ticket;
  }

  /** RF07: 404 (não 403) evita vazar a existência do ticket para outro CUSTOMER. */
  private assertVisible(actor: SanitizedUser, ticket: Ticket): void {
    if (actor.role === Role.CUSTOMER && ticket.createdById !== actor.id) {
      throw new NotFoundException({
        code: 'TICKET_NOT_FOUND',
        message: 'Ticket não encontrado.',
      });
    }
  }

  private toResponse(
    ticket: Ticket,
    attachments?: Attachment[],
  ): TicketResponse {
    return {
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      createdById: ticket.createdById,
      assignedToId: ticket.assignedToId,
      dueAt: ticket.dueAt,
      overdue: isOverdue(ticket),
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      closedAt: ticket.closedAt,
      ...(attachments
        ? {
            attachments: attachments.map((attachment) =>
              this.toAttachmentResponse(attachment),
            ),
          }
        : {}),
    };
  }

  private toAttachmentResponse(attachment: Attachment): AttachmentResponse {
    return {
      id: attachment.id,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      size: attachment.size,
      uploadedById: attachment.uploadedById,
      createdAt: attachment.createdAt,
      downloadUrl: `/tickets/${attachment.ticketId}/attachments/${attachment.id}/download`,
    };
  }
}
