import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { TicketsModule } from '../tickets/tickets.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

/**
 * Módulo de comentários (SPEC-04). Importa `TicketsModule` para reaproveitar
 * `TicketsService.getVisibleTicketOrThrow` (visibilidade de ticket, sem
 * duplicar lógica) e `StorageModule` para anexos de comentário.
 */
@Module({
  imports: [TicketsModule, StorageModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
