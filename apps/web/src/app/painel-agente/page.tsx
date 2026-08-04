'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CategoryBadge,
  PriorityBadge,
  SlaIndicator,
  StatusBadge,
} from '@/components/tickets/ticket-badges';
import { TicketCard } from '@/components/tickets/ticket-card';
import { useSession } from '@/lib/auth';
import {
  CATEGORY_LABELS,
  formatDateTime,
  formatUserRef,
  listTickets,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TicketsError,
  updateTicket,
  type PaginatedTickets,
  type Ticket,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from '@/lib/tickets';

const PAGE_SIZE = 20;

const STATUS_OPTIONS: TicketStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'RESOLVED',
  'CLOSED',
];

const PRIORITY_OPTIONS: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const CATEGORY_OPTIONS: TicketCategory[] = [
  'GENERAL',
  'TECHNICAL',
  'BILLING',
  'ACCOUNT',
  'FEATURE_REQUEST',
  'OTHER',
];

/** Ordem crescente de severidade, usada para ordenar por prioridade. */
const PRIORITY_ORDER: Record<TicketPriority, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  URGENT: 3,
};

/** Valor especial do filtro "Atribuição" — traduzido para o parâmetro real de `GET /tickets`. */
type AssigneeFilter = 'ALL' | 'MINE' | 'UNASSIGNED';

type SortColumn = 'createdAt' | 'priority';
type SortDirection = 'asc' | 'desc';

interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

/** Contadores de resumo do topo do painel (SPEC-08, seção 3). */
interface SummaryCounts {
  open: number;
  unassigned: number;
  overdue: number;
}

/**
 * Painel do agente (SPEC-08): fila de todos os tickets do sistema, com
 * filtros/paginação reais do backend (`GET /tickets`, SPEC-03) e ação
 * rápida de "Assumir" ticket não atribuído.
 *
 * Guard de acesso (RF01): `CUSTOMER` é redirecionado para `/tickets`. Isso
 * é só UX — o middleware (`src/middleware.ts`, SPEC-02) só verifica a
 * *presença* do cookie de sessão, não o papel do usuário; a autorização
 * real de leitura/escrita continua sendo aplicada pelo backend
 * (`TicketsService`) independentemente deste guard visual.
 */
export default function PainelAgentePage() {
  const router = useRouter();
  const { user, isLoading: isLoadingSession } = useSession();

  const isCustomer = user?.role === 'CUSTOMER';

  useEffect(() => {
    if (!isLoadingSession && isCustomer) {
      router.push('/tickets');
    }
  }, [isLoadingSession, isCustomer, router]);

  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'ALL'>(
    'ALL',
  );
  const [priorityFilter, setPriorityFilter] = useState<
    TicketPriority | 'ALL'
  >('ALL');
  const [categoryFilter, setCategoryFilter] = useState<
    TicketCategory | 'ALL'
  >('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>('ALL');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({
    column: 'createdAt',
    direction: 'desc',
  });

  const [result, setResult] = useState<PaginatedTickets | null>(null);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [counts, setCounts] = useState<SummaryCounts | null>(null);
  const [countsError, setCountsError] = useState<string | null>(null);

  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Reseta a página para 1 sempre que algum filtro muda (padrão "ajustar
  // estado durante a renderização" já usado em `src/app/tickets/page.tsx`,
  // SPEC-06 — evita `setState` dentro de um `useEffect`).
  const [appliedFilters, setAppliedFilters] = useState({
    statusFilter,
    priorityFilter,
    categoryFilter,
    assigneeFilter,
    overdueOnly,
  });
  if (
    appliedFilters.statusFilter !== statusFilter ||
    appliedFilters.priorityFilter !== priorityFilter ||
    appliedFilters.categoryFilter !== categoryFilter ||
    appliedFilters.assigneeFilter !== assigneeFilter ||
    appliedFilters.overdueOnly !== overdueOnly
  ) {
    setAppliedFilters({
      statusFilter,
      priorityFilter,
      categoryFilter,
      assigneeFilter,
      overdueOnly,
    });
    setPage(1);
    setIsLoadingTickets(true);
  }

  const assignedToIdParam = useMemo(() => {
    if (assigneeFilter === 'UNASSIGNED') return 'unassigned';
    if (assigneeFilter === 'MINE') return user?.id;
    return undefined;
  }, [assigneeFilter, user?.id]);

  // Busca a página atual de tickets via `GET /tickets`, com filtros e
  // paginação reais do backend (SPEC-08, diferente de `/tickets`
  // SPEC-06, que é CUSTOMER-only e filtra no cliente).
  //
  // `isLoadingTickets` nunca é setado para `true` de forma síncrona dentro
  // deste efeito (regra de lint `react-hooks/set-state-in-effect` do
  // projeto, mesma restrição já documentada em `tickets/[id]/page.tsx`):
  // o estado inicial já é `true` (primeira carga), e mudanças de
  // filtro/página o reativam a partir de um manipulador de evento ou do
  // bloco de "ajuste de estado durante a renderização" acima — nunca daqui.
  useEffect(() => {
    if (isLoadingSession || isCustomer) return;
    // Filtro "Meus tickets" depende do ID da sessão — evita disparar a
    // busca antes dele estar disponível.
    if (assigneeFilter === 'MINE' && !user?.id) return;

    let isMounted = true;

    listTickets({
      page,
      pageSize: PAGE_SIZE,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      priority: priorityFilter === 'ALL' ? undefined : priorityFilter,
      category: categoryFilter === 'ALL' ? undefined : categoryFilter,
      assignedToId: assignedToIdParam,
      overdue: overdueOnly ? true : undefined,
    })
      .then((response) => {
        if (isMounted) {
          setResult(response);
          setListError(null);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setListError(
            err instanceof TicketsError
              ? err.message
              : 'Não foi possível carregar a fila de tickets agora. Tente novamente.',
          );
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingTickets(false);
      });

    return () => {
      isMounted = false;
    };
  }, [
    isLoadingSession,
    isCustomer,
    page,
    statusFilter,
    priorityFilter,
    categoryFilter,
    assignedToIdParam,
    assigneeFilter,
    overdueOnly,
    user?.id,
  ]);

  /**
   * Contadores de resumo (SPEC-08, seção 3): três chamadas leves a
   * `GET /tickets` (`pageSize: 1`, lendo apenas `.total`) em vez de uma
   * nova chamada de agregação dedicada — decisão de implementação
   * explicitamente permitida pela SPEC-08 ("calculado a partir dos dados
   * já buscados ou de uma chamada agregada simples"). Não reaproveita os
   * dados já paginados da tabela porque estes refletem só a
   * página/filtro atuais, não o total global do sistema. Refeito também
   * após "Assumir" (`loadCounts`), já que isso muda a contagem de "não
   * atribuídos".
   */
  function loadCounts() {
    if (isLoadingSession || isCustomer) return;

    Promise.all([
      listTickets({ status: 'OPEN', pageSize: 1 }),
      listTickets({ assignedToId: 'unassigned', pageSize: 1 }),
      listTickets({ overdue: true, pageSize: 1 }),
    ])
      .then(([openResult, unassignedResult, overdueResult]) => {
        setCounts({
          open: openResult.total,
          unassigned: unassignedResult.total,
          overdue: overdueResult.total,
        });
        setCountsError(null);
      })
      .catch((err: unknown) => {
        setCountsError(
          err instanceof TicketsError
            ? err.message
            : 'Não foi possível carregar os contadores agora.',
        );
      });
  }

  useEffect(() => {
    loadCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingSession, isCustomer]);

  /**
   * Ordenação por coluna (SPEC-08, seção 3: "ao menos `createdAt` e
   * `priority`").
   *
   * NOTA (decisão de implementação documentada): `ListTicketsQueryDto`
   * (`apps/api/src/tickets/dto/list-tickets-query.schema.ts`, SPEC-03) não
   * aceita nenhum parâmetro de ordenação — o backend sempre ordena por
   * `createdAt desc` internamente. Estender esse contrato não é exigido
   * pela SPEC-08 (não é um endpoint faltando, é uma capacidade a mais em
   * um endpoint já existente), então a ordenação por coluna é aplicada no
   * cliente sobre os itens já buscados da página atual — suficiente para
   * reordenar visualmente a fila corrente, mas não reordena globalmente
   * através de páginas diferentes.
   */
  const sortedTickets = useMemo(() => {
    const items = result?.data ?? [];
    const sorted = [...items].sort((a, b) => {
      if (sort.column === 'priority') {
        return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      }
      return (
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });
    if (sort.direction === 'desc') sorted.reverse();
    return sorted;
  }, [result, sort]);

  function toggleSort(column: SortColumn) {
    setSort((current) => {
      if (current.column !== column) {
        return { column, direction: 'desc' };
      }
      return {
        column,
        direction: current.direction === 'asc' ? 'desc' : 'asc',
      };
    });
  }

  function sortIndicator(column: SortColumn): string {
    if (sort.column !== column) return '';
    return sort.direction === 'asc' ? ' ▲' : ' ▼';
  }

  /**
   * Ação "Assumir" (RF04, seção 3): `PATCH /tickets/:id` com
   * `assignedToId = session.user.id`, direto na linha, sem abrir o
   * detalhe. Atualiza a linha localmente (sem refazer a busca inteira) e
   * refaz os contadores (a contagem de "não atribuídos" muda).
   */
  async function handleAssume(ticket: Ticket) {
    if (!user) return;
    setAssigningId(ticket.id);
    setAssignError(null);
    try {
      const updated = await updateTicket(ticket.id, {
        assignedToId: user.id,
      });
      setResult((current) =>
        current
          ? {
              ...current,
              data: current.data.map((item) =>
                item.id === updated.id ? updated : item,
              ),
            }
          : current,
      );
      loadCounts();
    } catch (err) {
      setAssignError(
        err instanceof TicketsError
          ? err.message
          : 'Não foi possível assumir este ticket agora. Tente novamente.',
      );
    } finally {
      setAssigningId(null);
    }
  }

  // Enquanto a sessão carrega, ou para um CUSTOMER (redirecionamento em
  // andamento no efeito acima), não renderiza a fila.
  if (isLoadingSession || isCustomer) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFiltersApplied =
    statusFilter !== 'ALL' ||
    priorityFilter !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    assigneeFilter !== 'ALL' ||
    overdueOnly;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Painel do agente
        </h1>
        <p className="text-sm text-muted-foreground">
          Fila com todos os tickets do sistema, para triagem e atendimento.
        </p>
      </div>

      {countsError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{countsError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Abertos" value={counts?.open} />
        <SummaryCard label="Não atribuídos" value={counts?.unassigned} />
        <SummaryCard label="Atrasados" value={counts?.overdue} highlight />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>
            Combine filtros de status, prioridade, categoria e atribuição.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
          <div className="flex min-w-[180px] flex-1 flex-col gap-2">
            <label
              htmlFor="status-filter"
              className="text-sm font-medium text-foreground"
            >
              Status
            </label>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as TicketStatus | 'ALL')
              }
            >
              <SelectTrigger id="status-filter" aria-label="Filtrar por status">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os status</SelectItem>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex min-w-[180px] flex-1 flex-col gap-2">
            <label
              htmlFor="priority-filter"
              className="text-sm font-medium text-foreground"
            >
              Prioridade
            </label>
            <Select
              value={priorityFilter}
              onValueChange={(value) =>
                setPriorityFilter(value as TicketPriority | 'ALL')
              }
            >
              <SelectTrigger
                id="priority-filter"
                aria-label="Filtrar por prioridade"
              >
                <SelectValue placeholder="Todas as prioridades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas as prioridades</SelectItem>
                {PRIORITY_OPTIONS.map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {PRIORITY_LABELS[priority]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex min-w-[180px] flex-1 flex-col gap-2">
            <label
              htmlFor="category-filter"
              className="text-sm font-medium text-foreground"
            >
              Categoria
            </label>
            <Select
              value={categoryFilter}
              onValueChange={(value) =>
                setCategoryFilter(value as TicketCategory | 'ALL')
              }
            >
              <SelectTrigger
                id="category-filter"
                aria-label="Filtrar por categoria"
              >
                <SelectValue placeholder="Todas as categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas as categorias</SelectItem>
                {CATEGORY_OPTIONS.map((category) => (
                  <SelectItem key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex min-w-[180px] flex-1 flex-col gap-2">
            <label
              htmlFor="assignee-filter"
              className="text-sm font-medium text-foreground"
            >
              Atribuição
            </label>
            <Select
              value={assigneeFilter}
              onValueChange={(value) =>
                setAssigneeFilter(value as AssigneeFilter)
              }
            >
              <SelectTrigger
                id="assignee-filter"
                aria-label="Filtrar por atribuição"
              >
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="MINE">Meus tickets</SelectItem>
                <SelectItem value="UNASSIGNED">Não atribuídos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col justify-end gap-2">
            <span className="text-sm font-medium text-foreground">Prazo</span>
            <Button
              type="button"
              variant={overdueOnly ? 'default' : 'outline'}
              aria-pressed={overdueOnly}
              onClick={() => setOverdueOnly((current) => !current)}
            >
              Somente atrasados
            </Button>
          </div>
        </CardContent>
      </Card>

      {listError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{listError}</AlertDescription>
        </Alert>
      ) : null}

      {assignError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{assignError}</AlertDescription>
        </Alert>
      ) : null}

      {isLoadingTickets ? (
        <div
          className="flex flex-col gap-3"
          aria-label="Carregando fila de tickets"
        >
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : sortedTickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {hasFiltersApplied
                ? 'Nenhum ticket encontrado com os filtros selecionados.'
                : 'Nenhum ticket no sistema no momento.'}
            </p>
            {hasFiltersApplied ? (
              <Button
                variant="outline"
                onClick={() => {
                  setStatusFilter('ALL');
                  setPriorityFilter('ALL');
                  setCategoryFilter('ALL');
                  setAssigneeFilter('ALL');
                  setOverdueOnly(false);
                }}
              >
                Limpar filtros
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Tabela — telas médias/grandes (>= md). */}
          <Card className="hidden overflow-hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="font-medium hover:underline"
                      onClick={() => toggleSort('priority')}
                    >
                      Prioridade{sortIndicator('priority')}
                    </button>
                  </TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Prazo (SLA)</TableHead>
                  <TableHead>Agente responsável</TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="font-medium hover:underline"
                      onClick={() => toggleSort('createdAt')}
                    >
                      Criado em{sortIndicator('createdAt')}
                    </button>
                  </TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="max-w-xs">
                      <Link
                        href={`/tickets/${ticket.id}`}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {ticket.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatUserRef(ticket.createdById, user?.id)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={ticket.status} />
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={ticket.priority} />
                    </TableCell>
                    <TableCell>
                      <CategoryBadge category={ticket.category} />
                    </TableCell>
                    <TableCell>
                      <SlaIndicator
                        dueAt={ticket.dueAt}
                        overdue={ticket.overdue}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatUserRef(ticket.assignedToId, user?.id)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(ticket.createdAt)}
                    </TableCell>
                    <TableCell>
                      {ticket.assignedToId === null ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={assigningId === ticket.id}
                          onClick={() => handleAssume(ticket)}
                        >
                          {assigningId === ticket.id
                            ? 'Assumindo...'
                            : 'Assumir'}
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Cards — telas pequenas (< md), evita scroll horizontal. */}
          <div className="flex flex-col gap-3 md:hidden">
            {sortedTickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                leading={
                  <span>
                    Cliente: {formatUserRef(ticket.createdById, user?.id)}
                  </span>
                }
                trailing={
                  <>
                    <span>
                      Agente responsável:{' '}
                      {formatUserRef(ticket.assignedToId, user?.id)}
                    </span>
                    <span>Criado em: {formatDateTime(ticket.createdAt)}</span>
                  </>
                }
                action={
                  ticket.assignedToId === null ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-fit"
                      disabled={assigningId === ticket.id}
                      onClick={() => handleAssume(ticket)}
                    >
                      {assigningId === ticket.id ? 'Assumindo...' : 'Assumir'}
                    </Button>
                  ) : null
                }
              />
            ))}
          </div>

          {totalPages > 1 ? (
            <nav
              className="flex items-center justify-between gap-4"
              aria-label="Paginação da fila de tickets"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => {
                  setIsLoadingTickets(true);
                  setPage((current) => Math.max(1, current - 1));
                }}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {page} de {totalPages} ({total} tickets)
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => {
                  setIsLoadingTickets(true);
                  setPage((current) => Math.min(totalPages, current + 1));
                }}
              >
                Próxima
              </Button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | undefined;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-sm text-muted-foreground">{label}</span>
        {value === undefined ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <span
            className={
              highlight && value > 0
                ? 'text-2xl font-semibold text-destructive'
                : 'text-2xl font-semibold text-foreground'
            }
          >
            {value}
          </span>
        )}
      </CardContent>
    </Card>
  );
}
