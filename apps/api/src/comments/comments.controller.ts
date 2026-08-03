import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestWithUser } from '../auth/types/request-with-user.type';
import { TicketsExceptionFilter } from '../tickets/filters/tickets-exception.filter';
import { ZodValidationPipe } from '../tickets/pipes/zod-validation.pipe';
import { CommentsService } from './comments.service';
import type { CreateCommentDto } from './dto/create-comment.schema';
import { createCommentSchema } from './dto/create-comment.schema';
import type { CommentResponse } from './types/comment-response.type';

/**
 * Endpoints REST de comentários (SPEC-04), aninhados sob tickets. Protegidos
 * por `JwtAuthGuard`; a visibilidade por papel é resolvida dentro de
 * `CommentsService` (via `TicketsService.getVisibleTicketOrThrow`), mesma
 * regra de tickets (404 para `CUSTOMER` em ticket alheio). Reaproveita o
 * `TicketsExceptionFilter` para manter o mesmo formato de erro
 * (`{ error: { code, message } }`) já usado em `TicketsController`.
 */
@ApiTags('comments')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@UseFilters(TicketsExceptionFilter)
@Controller('tickets/:id/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Cria comentário no ticket (RF01–RF06/RF08/RF09). authorId vem da sessão; bloqueado em ticket CLOSED; nunca altera Ticket.status (SPEC-04 seção 9).',
  })
  @UseInterceptors(FilesInterceptor('files[]'))
  create(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createCommentSchema)) dto: CreateCommentDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ): Promise<CommentResponse> {
    return this.commentsService.create(
      req.user,
      id,
      dto,
      files.map((file) => ({
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      })),
    );
  }

  @Get()
  @ApiOperation({
    summary:
      'Lista comentários do ticket, ordenados por createdAt asc, com autor e anexos (RF04).',
  })
  findAll(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<CommentResponse[]> {
    return this.commentsService.findAll(req.user, id);
  }

  @Get(':commentId/attachments/:attachmentId/download')
  @ApiOperation({
    summary:
      'Download autenticado de anexo de comentário (RF07), mesma regra de visibilidade do ticket.',
  })
  async downloadAttachment(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { stream, attachment } =
      await this.commentsService.getAttachmentForDownload(
        req.user,
        id,
        commentId,
        attachmentId,
      );

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(attachment.filename)}"`,
    );
    stream.pipe(res);
  }
}
