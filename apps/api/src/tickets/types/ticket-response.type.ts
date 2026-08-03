import {
  Attachment,
  Ticket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';

export interface AttachmentResponse {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedById: string;
  createdAt: Date;
  downloadUrl: string;
}

export interface TicketResponse {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  createdById: string;
  assignedToId: string | null;
  dueAt: Date | null;
  overdue: boolean;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  attachments?: AttachmentResponse[];
}

export type TicketWithAttachments = Ticket & { attachments: Attachment[] };
