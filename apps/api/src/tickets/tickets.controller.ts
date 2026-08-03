import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestWithUser } from '../auth/types/request-with-user.type';
import type { CreateTicketDto } from './dto/create-ticket.schema';
import { createTicketSchema } from './dto/create-ticket.schema';
import type { ListTicketsQueryDto } from './dto/list-tickets-query.schema';
import { listTicketsQuerySchema } from './dto/list-tickets-query.schema';
import type { UpdateTicketDto } from './dto/update-ticket.schema';
import { updateTicketSchema } from './dto/update-ticket.schema';
import { TicketsExceptionFilter } from './filters/tickets-exception.filter';
import { ZodValidationPipe } from './pipes/zod-validation.pipe';
import type { PaginatedTickets } from './tickets.service';
import { TicketsService } from './tickets.service';
import type {
  AttachmentResponse,
  TicketResponse,
} from './types/ticket-response.type';

/**
 * Endpoints REST de tickets (SPEC-03). Protegidos por `JwtAuthGuard`; a
 * autorização por papel (quem pode ver/alterar o quê) é resolvida dentro de
 * `TicketsService`, sempre na cláusula `where`/checagem de campo — nunca só
 * filtrada em memória depois (SPEC-03, seção 6).
 */
@ApiTags('tickets')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@UseFilters(TicketsExceptionFilter)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @ApiOperation({
    summary:
      'Cria um ticket (RF01/RF02/RF08). createdById vem da sessão; status inicial é sempre OPEN; dueAt é calculado a partir de priority.',
  })
  create(
    @Req() req: RequestWithUser,
    @Body(new ZodValidationPipe(createTicketSchema)) dto: CreateTicketDto,
  ): Promise<TicketResponse> {
    return this.ticketsService.create(req.user, dto);
  }

  @Get()
  @ApiOperation({
    summary:
      'Lista tickets com filtros e paginação (RF03/RF04). CUSTOMER só vê os próprios.',
  })
  findAll(
    @Req() req: RequestWithUser,
    @Query(new ZodValidationPipe(listTicketsQuerySchema))
    query: ListTicketsQueryDto,
  ): Promise<PaginatedTickets> {
    return this.ticketsService.findAll(req.user, query);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Detalhe do ticket (RF07/RF09). 404 (não 403) se CUSTOMER tentar acessar ticket de outro usuário.',
  })
  findOne(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<TicketResponse> {
    return this.ticketsService.findOne(req.user, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Atualização parcial (RF05/RF06/RF13/RF14): campos permitidos variam por papel; status segue a máquina de estados restrita (SPEC-03 seção 9).',
  })
  update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTicketSchema)) dto: UpdateTicketDto,
  ): Promise<TicketResponse> {
    return this.ticketsService.update(req.user, id, dto);
  }

  @Post(':id/attachments')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Upload de anexo do ticket (RF10/RF11). Bloqueado se status === CLOSED; valida tamanho/tipo.',
  })
  @UseInterceptors(FileInterceptor('file'))
  addAttachment(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<AttachmentResponse> {
    return this.ticketsService.addAttachment(req.user, id, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });
  }

  @Get(':id/attachments')
  @ApiOperation({
    summary: 'Lista anexos do ticket (metadados + URL de download).',
  })
  listAttachments(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<AttachmentResponse[]> {
    return this.ticketsService.listAttachments(req.user, id);
  }

  @Get(':id/attachments/:attachmentId/download')
  @ApiOperation({
    summary:
      'Stream do arquivo em si (RF12), autenticado — driver local não expõe arquivos publicamente.',
  })
  async downloadAttachment(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { stream, attachment } =
      await this.ticketsService.getAttachmentForDownload(
        req.user,
        id,
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
