'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
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
import {
  CATEGORY_LABELS,
  formatDateTime,
  listTickets,
  STATUS_LABELS,
  TicketsError,
  type Ticket,
  type TicketCategory,
  type TicketStatus,
} from '@/lib/tickets';

const PAGE_SIZE = 10;

/**
 * Teto de itens buscados de uma vez do backend (`pageSize` máximo aceito por
 * `ListTicketsQueryDto`, SPEC-03). Ver nota em `src/lib/tickets.ts`
 * (`listTickets`): como o backend não filtra `status`/`category` por query
 * string para `CUSTOMER`, esta tela busca até este teto uma única vez e
 * aplica filtro + paginação inteiramente no cliente (RF02 — atualiza sem
 * recarregar a página). Limitação conhecida: clientes com mais de 100
 * tickets não veem os excedentes nesta tela (documentado, fora do escopo
 * resolver aqui — exigiria mudança no contrato de `GET /tickets` da
 * SPEC-03).
 */
const FETCH_LIMIT = 100;

const STATUS_OPTIONS: TicketStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'RESOLVED',
  'CLOSED',
];

const CATEGORY_OPTIONS: TicketCategory[] = [
  'GENERAL',
  'TECHNICAL',
  'BILLING',
  'ACCOUNT',
  'FEATURE_REQUEST',
  'OTHER',
];

/**
 * Listagem de tickets do `CUSTOMER` logado (SPEC-06, seção 3). Consome
 * `GET /tickets` (SPEC-03) uma única vez por carregamento e reaplica
 * filtro/paginação no cliente (ver `FETCH_LIMIT` acima).
 *
 * `useSearchParams` exige um `Suspense` boundary no App Router (detalhe de
 * infraestrutura Next.js, não funcional): este export default só existe
 * para isso, a tela em si é `TicketsPageContent`.
 */
export default function TicketsPage() {
  return (
    <Suspense fallback={null}>
      <TicketsPageContent />
    </Suspense>
  );
}

function TicketsPageContent() {
  const searchParams = useSearchParams();
  const justCreated = searchParams.get('created') === 'true';

  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'ALL'>(
    'ALL',
  );
  const [categoryFilter, setCategoryFilter] = useState<
    TicketCategory | 'ALL'
  >('ALL');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let isMounted = true;

    listTickets({ page: 1, pageSize: FETCH_LIMIT })
      .then((result) => {
        if (isMounted) setTickets(result.data);
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(
            err instanceof TicketsError
              ? err.message
              : 'Não foi possível carregar seus tickets agora. Tente novamente.',
          );
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Filtro por status/category (RF02): reage à mudança de estado local, sem
  // recarregar a página inteira e sem nova chamada de rede.
  const filteredTickets = useMemo(() => {
    if (!tickets) return [];
    return tickets.filter((ticket) => {
      if (statusFilter !== 'ALL' && ticket.status !== statusFilter) {
        return false;
      }
      if (categoryFilter !== 'ALL' && ticket.category !== categoryFilter) {
        return false;
      }
      return true;
    });
  }, [tickets, statusFilter, categoryFilter]);

  // Reseta a paginação para a primeira página quando o filtro muda
  // (padrão recomendado do React para "ajustar estado quando outro estado
  // muda": comparação durante o render, sem `useEffect`, para não disparar
  // uma renderização em cascata — https://react.dev/learn/you-might-not-need-an-effect).
  const [appliedFilters, setAppliedFilters] = useState({
    statusFilter,
    categoryFilter,
  });
  if (
    appliedFilters.statusFilter !== statusFilter ||
    appliedFilters.categoryFilter !== categoryFilter
  ) {
    setAppliedFilters({ statusFilter, categoryFilter });
    setPage(1);
  }

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTickets.length / PAGE_SIZE),
  );
  const currentPage = Math.min(page, totalPages);
  const pageItems = filteredTickets.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const hasAnyTicket = (tickets?.length ?? 0) > 0;
  const hasFiltersApplied = statusFilter !== 'ALL' || categoryFilter !== 'ALL';

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Meus tickets
          </h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe o andamento dos chamados que você abriu.
          </p>
        </div>
        <Button asChild>
          <Link href="/tickets/novo">Novo ticket</Link>
        </Button>
      </div>

      {justCreated ? (
        <Alert role="status">
          <AlertDescription>Ticket criado com sucesso.</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>
            Filtre pela sua lista de tickets por status ou categoria.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row">
          <div className="flex flex-1 flex-col gap-2">
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

          <div className="flex flex-1 flex-col gap-2">
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
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex flex-col gap-3" aria-label="Carregando tickets">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : !hasAnyTicket ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Você ainda não abriu nenhum ticket.
            </p>
            <Button asChild>
              <Link href="/tickets/novo">Abrir meu primeiro ticket</Link>
            </Button>
          </CardContent>
        </Card>
      ) : filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum ticket encontrado com os filtros selecionados.
            </p>
            {hasFiltersApplied ? (
              <Button
                variant="outline"
                onClick={() => {
                  setStatusFilter('ALL');
                  setCategoryFilter('ALL');
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
                  <TableHead>Status</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Prazo (SLA)</TableHead>
                  <TableHead>Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="max-w-xs">
                      <Link
                        href={`/tickets/${ticket.id}`}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {ticket.title}
                      </Link>
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
                      {formatDateTime(ticket.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Cards — telas pequenas (< md), evita scroll horizontal. */}
          <div className="flex flex-col gap-3 md:hidden">
            {pageItems.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                trailing={
                  <span>Criado em: {formatDateTime(ticket.createdAt)}</span>
                }
              />
            ))}
          </div>

          {totalPages > 1 ? (
            <nav
              className="flex items-center justify-between gap-4"
              aria-label="Paginação de tickets"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
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
