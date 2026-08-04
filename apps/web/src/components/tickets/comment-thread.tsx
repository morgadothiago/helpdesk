import type { CSSProperties } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  attachmentDownloadUrl,
  formatDateTime,
  formatFileSize,
  type Comment,
} from '@/lib/tickets';

const ROLE_LABELS: Record<'CUSTOMER' | 'AGENT' | 'ADMIN', string> = {
  CUSTOMER: 'Cliente',
  AGENT: 'Agente',
  ADMIN: 'Administrador',
};

/**
 * Lista de comentários de um ticket (SPEC-04/SPEC-07). Extraído da tela de
 * detalhe (`/tickets/[id]`) como componente reutilizável de UI, sem lógica
 * de busca/envio — apenas exibição (SPEC-09, seção 7).
 *
 * SPEC-09 item 10: cada comentário ganhou um avatar decorativo (iniciais do
 * autor, tons neutros — sem introduzir cor por papel para não conflitar com
 * a paleta semântica reservada a status/prioridade/SLA), entrada
 * escalonada (`animate-content-in`) e destaque sutil de hover, inspirados
 * em padrões de thread de conversa de Zendesk/Intercom.
 */
export function CommentThread({
  comments,
  isLoading,
  error,
}: {
  comments: Comment[] | null;
  isLoading: boolean;
  error: string | null;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!comments || comments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {comments.map((comment, index) => {
        const displayName = comment.author.name ?? comment.author.id;
        const initials = displayName.slice(0, 2).toUpperCase();

        return (
          <li
            key={comment.id}
            className="animate-content-in flex gap-3 rounded-md border border-border p-4 transition-colors hover:bg-muted/30"
            style={
              {
                '--stagger-delay': `${Math.min(index, 8) * 40}ms`,
              } as CSSProperties
            }
          >
            <div
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground"
            >
              {initials}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">
                  {displayName}{' '}
                  <span className="font-normal text-muted-foreground">
                    ({ROLE_LABELS[comment.author.role]})
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(comment.createdAt)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {comment.content}
              </p>
              {comment.attachments.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {comment.attachments.map((attachment) => (
                    <li key={attachment.id}>
                      <a
                        href={attachmentDownloadUrl(attachment.downloadUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-foreground underline-offset-4 hover:underline"
                      >
                        {attachment.filename}
                      </a>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {formatFileSize(attachment.size)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
