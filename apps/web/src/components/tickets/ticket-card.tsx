import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  CategoryBadge,
  PriorityBadge,
  SlaIndicator,
  StatusBadge,
} from '@/components/tickets/ticket-badges';
import type { Ticket } from '@/lib/tickets';

/**
 * Card de ticket usado no fallback "tabela → card" em telas pequenas
 * (SPEC-06/SPEC-08, `< md`). Consolida a estrutura comum — título com link,
 * linha de badges e prazo (SLA) — que antes era duplicada entre
 * `/tickets` e `/painel-agente` (SPEC-09, seção 7).
 *
 * Composição em vez de props booleanas (SPEC-09, seção 8): campos extras
 * específicos de cada tela (ex.: "Cliente"/"Agente responsável" no painel do
 * agente) e a ação "Assumir" são passados via `children`/`action`, em vez de
 * o componente conhecer todas as variações possíveis de conteúdo.
 */
export function TicketCard({
  ticket,
  leading,
  trailing,
  action,
}: {
  ticket: Ticket;
  /** Linhas extras de metadados renderizadas antes do prazo (ex.: "Cliente"). */
  leading?: ReactNode;
  /** Linhas extras de metadados renderizadas depois do prazo (ex.: "Criado em"). */
  trailing?: ReactNode;
  /** Slot de ação opcional (ex.: botão "Assumir"), renderizado ao final do card. */
  action?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <Link
          href={`/tickets/${ticket.id}`}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {ticket.title}
        </Link>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          <CategoryBadge category={ticket.category} />
        </div>
        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          {leading}
          <span>Prazo (SLA):</span>
          <SlaIndicator dueAt={ticket.dueAt} overdue={ticket.overdue} />
          {trailing}
        </div>
        {action}
      </CardContent>
    </Card>
  );
}
