import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { Readable } from 'stream';
import { StorageService, UploadFileInput } from './storage.service';

/**
 * Driver `local` do `StorageService` (SPEC-01, seção 3.2 — default de dev):
 * salva os arquivos em `apps/api/uploads/` (fora do controle de versão, ver
 * `.gitignore`), fora de qualquer diretório estático servido publicamente.
 * Arquivos só são acessíveis via endpoint autenticado do Nest
 * (`GET /tickets/:id/attachments/:attachmentId/download`, SPEC-03).
 */
@Injectable()
export class LocalStorageService implements StorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly uploadsDir: string;

  constructor(uploadsDir: string = join(process.cwd(), 'uploads')) {
    this.uploadsDir = uploadsDir;
  }

  async upload(file: UploadFileInput): Promise<string> {
    await mkdir(this.uploadsDir, { recursive: true });
    const storageKey = `${randomUUID()}-${sanitizeFilename(file.originalName)}`;
    const filePath = join(this.uploadsDir, storageKey);
    await writeFile(filePath, file.buffer);
    return storageKey;
  }

  getUrl(storageKey: string): string {
    // Driver local não expõe arquivos publicamente (SPEC-01, seção 3.2): a
    // "URL" retornada aqui é apenas uma referência interna; a URL real de
    // download é construída pelo TicketsService a partir do endpoint
    // autenticado (`/tickets/:id/attachments/:attachmentId/download`).
    return `local://${storageKey}`;
  }

  async delete(storageKey: string): Promise<void> {
    const filePath = join(this.uploadsDir, storageKey);
    try {
      await rm(filePath);
    } catch (error) {
      this.logger.warn(
        `Falha ao remover arquivo local ${storageKey}: ${String(error)}`,
      );
    }
  }

  getFileStream(storageKey: string): Promise<Readable> {
    const filePath = join(this.uploadsDir, storageKey);
    const stream = createReadStream(filePath);
    return new Promise((resolve, reject) => {
      stream.once('open', () => resolve(stream));
      stream.once('error', () =>
        reject(new NotFoundException('Arquivo não encontrado.')),
      );
    });
  }
}

function sanitizeFilename(originalName: string): string {
  return originalName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
}
