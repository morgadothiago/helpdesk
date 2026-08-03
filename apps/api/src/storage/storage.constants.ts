// Constantes do StorageService (SPEC-01, seção 3.2 / SPEC-03).

/** Token de injeção do `StorageService` (permite trocar de driver via `StorageModule`). */
export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');

/** Limite máximo por arquivo (INFERRED, SPEC-01 seção 3.2). */
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Lista de mimetypes permitidos (INFERRED, SPEC-01 seção 3.2): imagens, PDF,
 * texto e documentos office.
 */
export const ALLOWED_ATTACHMENT_MIME_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
