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
      {comments.map((comment) => (
        <li
          key={comment.id}
          className="flex flex-col gap-2 rounded-md border border-border p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground">
              {comment.author.name ?? comment.author.id}{' '}
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
        </li>
      ))}
    </ul>
  );
}
