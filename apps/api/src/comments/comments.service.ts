import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TicketStatus } from '@prisma/client';
import { Readable } from 'stream';
import { PrismaService } from '../prisma/prisma.service';
import { SanitizedUser } from '../auth/types/sanitized-user.type';
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
  STORAGE_SERVICE,
} from '../storage/storage.constants';
import type { StorageService } from '../storage/storage.service';
import type { UploadAttachmentInput } from '../tickets/tickets.service';
import { TicketsService } from '../tickets/tickets.service';
import { CreateCommentDto } from './dto/create-comment.schema';
import {
  CommentResponse,
  CommentWithRelations,
} from './types/comment-response.type';

/**
 * Regras de negócio de comentários (SPEC-04). Reaproveita
 * `TicketsService.getVisibleTicketOrThrow` para a mesma checagem de
 * visibilidade de ticket da SPEC-03 (404 para `CUSTOMER` em ticket alheio,
 * SPEC-04 seção 6) — nunca duplica essa lógica.
 *
 * Importante (SPEC-04, seção 9/11): este service NUNCA escreve em
 * `Ticket.status` nem chama nenhum método de escrita/transição de status do
 * `TicketsService` (ex. `update`/`assertValidTransition` não são usados
 * aqui). Criar um comentário é um efeito isolado — persiste o `Comment` (e
 * seus anexos, se houver) e nada mais.
 */
@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketsService: TicketsService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  /**
   * RF01/RF02/RF03/RF05/RF06/RF08/RF09: cria o comentário (e anexos, se
   * houver) de forma atômica — arquivos inválidos impedem a criação do
   * comentário e dos demais anexos do mesmo request (RF06).
   */
  async create(
    actor: SanitizedUser,
    ticketId: string,
    dto: CreateCommentDto,
    files: UploadAttachmentInput[],
  ): Promise<CommentResponse> {
    const ticket = await this.ticketsService.getVisibleTicketOrThrow(
      actor,
      ticketId,
    );

    // RF03: ticket CLOSED não aceita novos comentários, para nenhum papel.
    if (ticket.status === TicketStatus.CLOSED) {
      throw new ConflictException({
        code: 'TICKET_CLOSED',
        message: 'Ticket encerrado não aceita novos comentários.',
      });
    }

    // RF06: valida todos os arquivos antes de persistir ou enviar qualquer
    // coisa ao storage — tudo ou nada.
    for (const file of files) {
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
    }

    const uploaded: { storageKey: string; file: UploadAttachmentInput }[] = [];

    try {
      for (const file of files) {
        const storageKey = await this.storage.upload({
          buffer: file.buffer,
          originalName: file.originalname,
          mimeType: file.mimetype,
        });
        uploaded.push({ storageKey, file });
      }

      const comment = await this.prisma.$transaction(async (tx) => {
        const created = await tx.comment.create({
          data: {
            content: dto.content,
            ticketId,
            authorId: actor.id,
          },
        });

        if (uploaded.length > 0) {
          await tx.attachment.createMany({
            data: uploaded.map(({ storageKey, file }) => ({
              filename: file.originalname,
              mimeType: file.mimetype,
              size: file.size,
              storageKey,
              commentId: created.id,
              uploadedById: actor.id,
            })),
          });
        }

        return tx.comment.findUniqueOrThrow({
          where: { id: created.id },
          include: { author: true, attachments: true },
        });
      });

      return this.toResponse(comment);
    } catch (error) {
      // Melhor esforço: remove arquivos já persistidos no storage se a
      // escrita no banco falhar, para manter a atomicidade percebida
      // (RF06 — tudo ou nada).
      await Promise.all(
        uploaded.map(({ storageKey }) => this.storage.delete(storageKey)),
      ).catch(() => undefined);
      throw error;
    }
  }

  /** RF04: lista comentários ordenados por createdAt asc, com autor e anexos. */
  async findAll(
    actor: SanitizedUser,
    ticketId: string,
  ): Promise<CommentResponse[]> {
    await this.ticketsService.getVisibleTicketOrThrow(actor, ticketId);

    const comments = await this.prisma.comment.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      include: { author: true, attachments: true },
    });

    return comments.map((comment) => this.toResponse(comment));
  }

  /** RF07: mesma regra de visibilidade do ticket (404 para anexo de comentário de outro CUSTOMER). */
  async getAttachmentForDownload(
    actor: SanitizedUser,
    ticketId: string,
    commentId: string,
    attachmentId: string,
  ): Promise<{
    stream: Readable;
    attachment: { mimeType: string; filename: string };
  }> {
    await this.ticketsService.getVisibleTicketOrThrow(actor, ticketId);

    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { comment: true },
    });

    if (
      !attachment ||
      attachment.commentId !== commentId ||
      attachment.comment?.ticketId !== ticketId
    ) {
      throw new NotFoundException({
        code: 'ATTACHMENT_NOT_FOUND',
        message: 'Anexo não encontrado.',
      });
    }

    const stream = await this.storage.getFileStream(attachment.storageKey);
    return { stream, attachment };
  }

  private toResponse(comment: CommentWithRelations): CommentResponse {
    return {
      id: comment.id,
      content: comment.content,
      ticketId: comment.ticketId,
      authorId: comment.authorId,
      author: {
        id: comment.author.id,
        name: comment.author.name,
        role: comment.author.role,
      },
      attachments: comment.attachments.map((attachment) => ({
        id: attachment.id,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        size: attachment.size,
        uploadedById: attachment.uploadedById,
        createdAt: attachment.createdAt,
        downloadUrl: `/tickets/${comment.ticketId}/comments/${comment.id}/attachments/${attachment.id}/download`,
      })),
      createdAt: comment.createdAt,
    };
  }
}
