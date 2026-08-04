'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  useEffect,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
} from 'react';
import { useForm } from 'react-hook-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  CategoryBadge,
  PriorityBadge,
  SlaIndicator,
  StatusBadge,
} from '@/components/tickets/ticket-badges';
import { CommentThread } from '@/components/tickets/comment-thread';
import { useSession } from '@/lib/auth';
import {
  attachmentDownloadUrl,
  CATEGORY_LABELS,
  createComment,
  formatDateTime,
  formatFileSize,
  formatUserRef,
  getTicket,
  listComments,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TicketsError,
  updateTicket,
  uploadTicketAttachment,
  type Comment,
  type Ticket,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from '@/lib/tickets';
import {
  agentEditSchema,
  commentSchema,
  ticketFieldsSchema,
  type AgentEditFormValues,
  type CommentFormValues,
  type TicketFieldsFormValues,
} from '@/lib/validation';

const TITLE_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 5000;
const COMMENT_MAX_LENGTH = 5000;

const PRIORITY_OPTIONS: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const CATEGORY_OPTIONS: TicketCategory[] = [
  'GENERAL',
  'TECHNICAL',
  'BILLING',
  'ACCOUNT',
  'FEATURE_REQUEST',
  'OTHER',
];

/**
 * Transições válidas de status (SPEC-03, seção 9 — duplicado manualmente de
 * `apps/api/src/tickets/constants/status-transitions.constants.ts`, mesma
 * convenção de duplicação já aceita para os enums em `src/lib/tickets.ts`).
 *
 * Usado apenas para reduzir opções obviamente inválidas no `<Select>` de
 * status (bônus de UX previsto na SPEC-07, seção 3) — nunca é a fonte de
 * verdade: a validação real acontece sempre no backend
 * (`TicketsService.assertValidTransition`), e qualquer erro 409 retornado
 * por ele ainda é tratado e exibido normalmente.
 */
const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['IN_PROGRESS'],
  IN_PROGRESS: ['WAITING_CUSTOMER', 'RESOLVED'],
  WAITING_CUSTOMER: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'OPEN', 'IN_PROGRESS'],
  CLOSED: ['OPEN', 'IN_PROGRESS'],
};

function statusOptionsFor(current: TicketStatus): TicketStatus[] {
  const next = STATUS_TRANSITIONS[current] ?? [];
  return [current, ...next.filter((status) => status !== current)];
}

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const ticketId = params.id;
  const { user } = useSession();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoadingTicket, setIsLoadingTicket] = useState(true);
  const [ticketNotFound, setTicketNotFound] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [comments, setComments] = useState<Comment[] | null>(null);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [commentsError, setCommentsError] = useState<string | null>(null);

  /**
   * Busca o detalhe do ticket via promise chain (não `async`/`await`) para
   * que nenhum `setState` seja disparado sincronamente dentro do corpo do
   * efeito — apenas dentro dos callbacks `.then`/`.catch`/`.finally`, que
   * sempre rodam como microtask assíncrona. Mesmo padrão de
   * `src/app/tickets/page.tsx` (SPEC-06), necessário para respeitar a regra
   * de lint `react-hooks/set-state-in-effect` do projeto.
   */
  useEffect(() => {
    let isMounted = true;

    getTicket(ticketId)
      .then((result) => {
        if (!isMounted) return;
        setTicket(result);
        setTicketError(null);
        setTicketNotFound(false);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        if (err instanceof TicketsError && err.status === 404) {
          setTicketNotFound(true);
        } else {
          setTicketError(
            err instanceof TicketsError
              ? err.message
              : 'Não foi possível carregar este ticket agora. Tente novamente.',
          );
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingTicket(false);
      });

    return () => {
      isMounted = false;
    };
  }, [ticketId, reloadToken]);

  useEffect(() => {
    if (!ticket) return;
    let isMounted = true;

    listComments(ticketId)
      .then((result) => {
        if (isMounted) setComments(result);
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setCommentsError(
            err instanceof TicketsError
              ? err.message
              : 'Não foi possível carregar os comentários agora. Tente novamente.',
          );
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingComments(false);
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(ticket), ticketId]);

  /**
   * Retry manual (botão "Tentar novamente"): incrementa `reloadToken` para
   * disparar o efeito de busca acima novamente. Chamado a partir de um
   * manipulador de evento (não de um efeito), então pode ajustar o estado
   * de loading livremente sem violar `react-hooks/set-state-in-effect`.
   */
  function handleRetryTicket() {
    setIsLoadingTicket(true);
    setTicketError(null);
    setReloadToken((token) => token + 1);
  }

  if (isLoadingTicket) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (ticketNotFound) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-foreground">
          Ticket não encontrado
        </h1>
        <p className="text-sm text-muted-foreground">
          O ticket que você está tentando acessar não existe ou você não tem
          permissão para visualizá-lo.
        </p>
        <Button asChild>
          <Link href="/tickets">Voltar para meus tickets</Link>
        </Button>
      </div>
    );
  }

  if (ticketError || !ticket) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {ticketError ??
              'Não foi possível carregar este ticket agora. Tente novamente.'}
          </AlertDescription>
        </Alert>
        <Button variant="outline" onClick={handleRetryTicket} className="w-fit">
          Tentar novamente
        </Button>
      </div>
    );
  }

  const isClosed = ticket.status === 'CLOSED';
  const isCustomer = user?.role === 'CUSTOMER';
  const isAgentOrAdmin = user?.role === 'AGENT' || user?.role === 'ADMIN';

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/tickets"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          &larr; Meus tickets
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-foreground">
            {ticket.title}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          <CategoryBadge category={ticket.category} />
        </div>
      </div>

      <TicketInfoCard ticket={ticket} currentUserId={user?.id} />

      {isCustomer ? (
        <CustomerEditCard
          ticket={ticket}
          onUpdated={(updated) => setTicket(updated)}
        />
      ) : null}

      {isAgentOrAdmin ? (
        <AgentEditCard
          ticket={ticket}
          onUpdated={(updated) => setTicket(updated)}
        />
      ) : null}

      <AttachmentsCard
        ticket={ticket}
        onUploaded={(updated) => setTicket(updated)}
      />

      <CommentsSection
        ticketId={ticketId}
        isClosed={isClosed}
        comments={comments}
        isLoading={isLoadingComments}
        error={commentsError}
        onCommentCreated={(comment) =>
          setComments((current) => (current ? [...current, comment] : [comment]))
        }
      />
    </div>
  );
}

function TicketInfoCard({
  ticket,
  currentUserId,
}: {
  ticket: Ticket;
  currentUserId: string | undefined;
}) {
  return (
    <Card className="animate-content-in">
      <CardHeader>
        <CardTitle className="text-base">Detalhes do ticket</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">Descrição</p>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {ticket.description}
          </p>
        </div>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Solicitante</dt>
            <dd className="text-foreground">
              {formatUserRef(ticket.createdById, currentUserId)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Agente responsável</dt>
            <dd className="text-foreground">
              {formatUserRef(ticket.assignedToId, currentUserId)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Prazo (SLA)</dt>
            <dd className="text-foreground">
              <SlaIndicator dueAt={ticket.dueAt} overdue={ticket.overdue} />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Criado em</dt>
            <dd className="text-foreground">
              {formatDateTime(ticket.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Atualizado em</dt>
            <dd className="text-foreground">
              {formatDateTime(ticket.updatedAt)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Encerrado em</dt>
            <dd className="text-foreground">
              {formatDateTime(ticket.closedAt)}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

/**
 * CUSTOMER: edita `title`/`description` apenas enquanto `status === 'OPEN'`
 * (SPEC-07, seção 3 / SPEC-03 `CUSTOMER_ALLOWED_FIELDS`). Fora disso os
 * campos ficam somente leitura.
 *
 * Validação via `react-hook-form` + `yup` (`ticketFieldsSchema`, SPEC-09),
 * mesmo schema usado na criação do ticket.
 */
function CustomerEditCard({
  ticket,
  onUpdated,
}: {
  ticket: Ticket;
  onUpdated: (updated: Ticket) => void;
}) {
  const editable = ticket.status === 'OPEN';
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TicketFieldsFormValues>({
    resolver: yupResolver(ticketFieldsSchema),
    defaultValues: { title: ticket.title, description: ticket.description },
  });

  // Ressincroniza os campos do formulário quando `ticket.title`/`description`
  // muda "por baixo" (ex.: após um PATCH bem-sucedido, ou troca de ticket) —
  // uso padrão de `reset()` do react-hook-form em resposta a uma prop
  // externa mudar, não um `setState` bruto de `useState`.
  useEffect(() => {
    reset({ title: ticket.title, description: ticket.description });
  }, [reset, ticket.title, ticket.description]);

  async function onSubmit(values: TicketFieldsFormValues) {
    setSubmitError(null);
    setSuccessMessage(null);
    setIsSaving(true);
    try {
      const updated = await updateTicket(ticket.id, {
        title: values.title,
        description: values.description,
      });
      onUpdated(updated);
      setSuccessMessage('Alterações salvas com sucesso.');
    } catch (err) {
      setSubmitError(
        err instanceof TicketsError
          ? err.message
          : 'Não foi possível salvar as alterações agora. Tente novamente.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card
      className="animate-content-in"
      style={{ '--stagger-delay': '80ms' } as CSSProperties}
    >
      <CardHeader>
        <CardTitle className="text-base">Editar ticket</CardTitle>
        <CardDescription>
          {editable
            ? 'Você pode editar o título e a descrição enquanto o ticket estiver aberto.'
            : 'Este ticket não está mais aberto — título e descrição não podem mais ser editados.'}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="flex flex-col gap-4">
          {submitError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}
          {successMessage ? (
            <Alert role="status">
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-title">Título</Label>
            <Input
              id="edit-title"
              maxLength={TITLE_MAX_LENGTH}
              disabled={!editable}
              aria-invalid={errors.title ? true : undefined}
              {...register('title')}
            />
            {errors.title ? (
              <p role="alert" className="text-sm text-destructive">
                {errors.title.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-description">Descrição</Label>
            <Textarea
              id="edit-description"
              rows={5}
              maxLength={DESCRIPTION_MAX_LENGTH}
              disabled={!editable}
              aria-invalid={errors.description ? true : undefined}
              {...register('description')}
            />
            {errors.description ? (
              <p role="alert" className="text-sm text-destructive">
                {errors.description.message}
              </p>
            ) : null}
          </div>
        </CardContent>
        {editable ? (
          <CardFooter>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </CardFooter>
        ) : null}
      </form>
    </Card>
  );
}

/**
 * AGENT/ADMIN: altera `status`, `priority`, `category` e `assignedToId`
 * (SPEC-07, seção 3 / SPEC-03 `AGENT_ALLOWED_FIELDS`).
 *
 * `assignedToId` é um campo de texto livre (ID do usuário), não um
 * `<Select>` com nomes — não existe endpoint de listagem de usuários no
 * backend (ver nota em `formatUserRef`), então um select populado com
 * nomes reais não é possível sem inventar um contrato novo. O backend
 * ainda valida que o ID corresponde a um usuário existente (400
 * `ASSIGNEE_NOT_FOUND` caso contrário), erro tratado normalmente abaixo.
 *
 * Migrado para `react-hook-form` (SPEC-09): `status`/`priority`/`category`
 * continuam controlados (o `Select` do shadcn/ui não expõe um `<select>`
 * nativo compatível com `register`), registrados via `setValue`;
 * `assignedToId` usa `register` diretamente.
 */
function AgentEditCard({
  ticket,
  onUpdated,
}: {
  ticket: Ticket;
  onUpdated: (updated: Ticket) => void;
}) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const defaultValues: AgentEditFormValues = {
    status: ticket.status,
    priority: ticket.priority,
    category: ticket.category,
    assignedToId: ticket.assignedToId ?? '',
  };

  const { register, handleSubmit, watch, setValue, reset } =
    useForm<AgentEditFormValues>({
      resolver: yupResolver(agentEditSchema),
      defaultValues,
    });

  // Ressincroniza o formulário quando o ticket muda "por baixo" (mesmo
  // padrão de `reset()` usado em `CustomerEditCard` acima).
  useEffect(() => {
    reset({
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      assignedToId: ticket.assignedToId ?? '',
    });
  }, [reset, ticket.status, ticket.priority, ticket.category, ticket.assignedToId]);

  const status = watch('status') as TicketStatus;
  const priority = watch('priority') as TicketPriority;
  const category = watch('category') as TicketCategory;

  async function onSubmit(values: AgentEditFormValues) {
    setSubmitError(null);
    setSuccessMessage(null);
    setIsSaving(true);
    try {
      const updated = await updateTicket(ticket.id, {
        status: values.status as TicketStatus,
        priority: values.priority as TicketPriority,
        category: values.category as TicketCategory,
        assignedToId:
          !values.assignedToId || values.assignedToId.trim() === ''
            ? null
            : values.assignedToId.trim(),
      });
      onUpdated(updated);
      setSuccessMessage('Alterações salvas com sucesso.');
    } catch (err) {
      setSubmitError(
        err instanceof TicketsError
          ? err.message
          : 'Não foi possível salvar as alterações agora. Tente novamente.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card
      className="animate-content-in"
      style={{ '--stagger-delay': '80ms' } as CSSProperties}
    >
      <CardHeader>
        <CardTitle className="text-base">Gerenciar ticket</CardTitle>
        <CardDescription>
          Altere o status, a prioridade, a categoria ou reatribua este
          ticket.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="flex flex-col gap-4">
          {submitError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}
          {successMessage ? (
            <Alert role="status">
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="agent-status">Status</Label>
              <Select
                value={status}
                onValueChange={(value) =>
                  setValue('status', value, { shouldDirty: true })
                }
              >
                <SelectTrigger id="agent-status" aria-label="Status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptionsFor(ticket.status).map((option) => (
                    <SelectItem key={option} value={option}>
                      {STATUS_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="agent-priority">Prioridade</Label>
              <Select
                value={priority}
                onValueChange={(value) =>
                  setValue('priority', value, { shouldDirty: true })
                }
              >
                <SelectTrigger id="agent-priority" aria-label="Prioridade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {PRIORITY_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="agent-category">Categoria</Label>
              <Select
                value={category}
                onValueChange={(value) =>
                  setValue('category', value, { shouldDirty: true })
                }
              >
                <SelectTrigger id="agent-category" aria-label="Categoria">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {CATEGORY_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="agent-assigned">
                Atribuído a (ID do usuário)
              </Label>
              <Input
                id="agent-assigned"
                placeholder="Deixe em branco para remover atribuição"
                {...register('assignedToId')}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function AttachmentsCard({
  ticket,
  onUploaded,
}: {
  ticket: Ticket;
  onUploaded: (updated: Ticket) => void;
}) {
  const isClosed = ticket.status === 'CLOSED';
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const attachments = ticket.attachments ?? [];

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(0);
    try {
      await uploadTicketAttachment(ticket.id, file, (percent) =>
        setUploadProgress(percent),
      );
      const refreshed = await getTicket(ticket.id);
      onUploaded(refreshed);
      setFile(null);
      event.currentTarget.reset();
    } catch (err) {
      setUploadError(
        err instanceof TicketsError
          ? err.message
          : 'Não foi possível enviar o anexo agora. Tente novamente.',
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  }

  return (
    <Card
      className="animate-content-in"
      style={{ '--stagger-delay': '160ms' } as CSSProperties}
    >
      <CardHeader>
        <CardTitle className="text-base">Anexos</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum anexo neste ticket.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {attachments.map((attachment) => (
              <li
                key={attachment.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border p-3 text-sm transition-colors hover:bg-muted/30"
              >
                <div className="flex flex-col">
                  <a
                    href={attachmentDownloadUrl(attachment.downloadUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {attachment.filename}
                  </a>
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.size)} ·{' '}
                    {formatDateTime(attachment.createdAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-2 pt-0">
          {uploadError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          ) : null}
          {isClosed ? (
            <p className="text-sm text-muted-foreground">
              Ticket encerrado — não é possível adicionar novos anexos.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-attachment">Adicionar anexo</Label>
              <Input
                id="new-attachment"
                name="attachment"
                type="file"
                onChange={handleFileChange}
                disabled={isUploading}
              />
              {isUploading ? (
                <div className="flex flex-col gap-1">
                  <Progress
                    value={uploadProgress ?? undefined}
                    label="Progresso do envio do anexo"
                  />
                  <span className="text-xs text-muted-foreground">
                    {uploadProgress !== null
                      ? `Enviando... ${Math.round(uploadProgress)}%`
                      : 'Enviando...'}
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
        {!isClosed ? (
          <CardFooter>
            <Button type="submit" disabled={!file || isUploading}>
              {isUploading ? 'Enviando...' : 'Enviar anexo'}
            </Button>
          </CardFooter>
        ) : null}
      </form>
    </Card>
  );
}

/**
 * Formulário de novo comentário via `react-hook-form` + `yup`
 * (`commentSchema`, SPEC-09), espelhando `createCommentSchema` do backend.
 * A lista de comentários em si é renderizada por `CommentThread`
 * (`src/components/tickets/comment-thread.tsx`), extraído desta tela como
 * componente reutilizável de exibição (SPEC-09, seção 7).
 */
function CommentsSection({
  ticketId,
  isClosed,
  comments,
  isLoading,
  error,
  onCommentCreated,
}: {
  ticketId: string;
  isClosed: boolean;
  comments: Comment[] | null;
  isLoading: boolean;
  error: string | null;
  onCommentCreated: (comment: Comment) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CommentFormValues>({
    resolver: yupResolver(commentSchema),
    defaultValues: { content: '' },
  });

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
  }

  async function onSubmit(values: CommentFormValues) {
    setSubmitError(null);

    const formData = new FormData();
    formData.append('content', values.content);
    if (file) {
      formData.append('files[]', file);
    }

    setIsSending(true);
    try {
      const comment = await createComment(ticketId, formData);
      onCommentCreated(comment);
      reset({ content: '' });
      setFile(null);
    } catch (err) {
      setSubmitError(
        err instanceof TicketsError
          ? err.message
          : 'Não foi possível enviar o comentário agora. Tente novamente.',
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Card
      className="animate-content-in"
      style={{ '--stagger-delay': '240ms' } as CSSProperties}
    >
      <CardHeader>
        <CardTitle className="text-base">Comentários</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <CommentThread comments={comments} isLoading={isLoading} error={error} />
      </CardContent>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="flex flex-col gap-4 pt-0">
          {submitError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}

          {isClosed ? (
            <p className="text-sm text-muted-foreground">
              Este ticket está encerrado — não é possível adicionar novos
              comentários.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-comment">Novo comentário</Label>
                <Textarea
                  id="new-comment"
                  rows={4}
                  maxLength={COMMENT_MAX_LENGTH}
                  aria-invalid={errors.content ? true : undefined}
                  {...register('content')}
                />
                {errors.content ? (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.content.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="comment-attachment">Anexo (opcional)</Label>
                <Input
                  id="comment-attachment"
                  name="attachment"
                  type="file"
                  onChange={handleFileChange}
                />
              </div>
            </>
          )}
        </CardContent>
        {!isClosed ? (
          <CardFooter>
            <Button type="submit" disabled={isSending}>
              {isSending ? 'Enviando...' : 'Enviar comentário'}
            </Button>
          </CardFooter>
        ) : null}
      </form>
    </Card>
  );
}
