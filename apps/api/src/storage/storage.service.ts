import { Readable } from 'stream';

/** Arquivo a ser persistido pelo `StorageService.upload` (SPEC-01, seção 3.2). */
export interface UploadFileInput {
  /** Conteúdo binário do arquivo. */
  buffer: Buffer;
  /** Nome original enviado pelo cliente (não usado como chave de storage). */
  originalName: string;
  mimeType: string;
}

/**
 * Abstração única de storage de arquivos (SPEC-01, seção 3.2), implementada
 * por um driver configurável via `STORAGE_DRIVER` (`local` neste MVP —
 * `blob` é decisão de infraestrutura futura, fora do escopo da SPEC-03).
 *
 * Nenhum código de negócio (controllers/services de ticket/comentário) deve
 * depender da implementação concreta — apenas desta interface, injetada via
 * token `STORAGE_SERVICE` (`storage.module.ts`).
 */
export interface StorageService {
  /** Persiste o arquivo e retorna a `storageKey` a ser guardada em `Attachment.storageKey`. */
  upload: (file: UploadFileInput) => Promise<string>;

  /**
   * Referência de acesso ao arquivo a partir da `storageKey`. Para o driver
   * `local` (que não expõe arquivos publicamente, SPEC-01 seção 3.2), retorna
   * apenas uma referência interna — o download real acontece via
   * `getFileStream`, atrás do endpoint autenticado do Nest
   * (`GET /tickets/:id/attachments/:attachmentId/download`, SPEC-03).
   */
  getUrl: (storageKey: string) => string;

  /** Remove o arquivo do storage. */
  delete: (storageKey: string) => Promise<void>;

  /** Lê o conteúdo do arquivo como stream, para servir via endpoint autenticado. */
  getFileStream: (storageKey: string) => Promise<Readable>;
}
