import { Attachment, Comment, Role, User } from '@prisma/client';

/** Anexo de comentário (SPEC-04, seção 3): metadados + URL de download autenticado. */
export interface CommentAttachmentResponse {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedById: string;
  createdAt: Date;
  downloadUrl: string;
}

/**
 * Dados mínimos do autor expostos em cada comentário (SPEC-04, seção 10):
 * nome e role, nunca dados sensíveis (senha/hash).
 */
export interface CommentAuthorResponse {
  id: string;
  name: string | null;
  role: Role;
}

export interface CommentResponse {
  id: string;
  content: string;
  ticketId: string;
  authorId: string;
  author: CommentAuthorResponse;
  attachments: CommentAttachmentResponse[];
  createdAt: Date;
}

export type CommentWithRelations = Comment & {
  author: User;
  attachments: Attachment[];
};
