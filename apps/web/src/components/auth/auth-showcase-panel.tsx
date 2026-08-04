import type { CSSProperties } from 'react';
import { Clock, Inbox, LifeBuoy, MessageSquare } from 'lucide-react';

import { cn } from '@/lib/utils';

const HIGHLIGHTS = [
  {
    icon: Inbox,
    label: 'Fila unificada de chamados',
    description: 'Nenhum pedido de suporte se perde entre e-mail, chat e telefone.',
  },
  {
    icon: Clock,
    label: 'Prazos de SLA sempre visíveis',
    description: 'Atrasos são sinalizados antes de virarem problema para o cliente.',
  },
  {
    icon: MessageSquare,
    label: 'Histórico completo por ticket',
    description: 'Toda a conversa, anexos e decisões em um único lugar.',
  },
] as const;

/**
 * Painel de marca exibido ao lado do formulário em `/login` e `/registro`
 * a partir de `lg:` (~1024px+, SPEC-09, item 11 — refeita do item 9).
 *
 * Substitui o painel decorativo genérico da versão anterior (commit
 * `7c50878`, padrão de pontos + frase única) por uma peça de marca real:
 * wordmark do produto, headline de valor específica da tela chamadora e
 * 2-3 destaques do que o helpdesk resolve de fato (reflete funcionalidade
 * já implementada — fila de tickets, `SlaIndicator`, `CommentThread` — não
 * é copy inventada). Uso mais expressivo do token `primary`/
 * `primary-foreground` (mesma cor do CTA principal, aqui em área grande)
 * em vez de introduzir uma cor de marca nova (item 11.e).
 *
 * Puramente visual/decorativo — `aria-hidden`, não é conteúdo funcional da
 * página, então não precisa (nem deve) ser lido por leitor de tela.
 */
export function AuthShowcasePanel({
  tagline,
  className,
}: {
  tagline: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative hidden overflow-hidden rounded-3xl bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-12',
        className,
      )}
    >
      <div className="auth-grid-pattern absolute inset-0" />
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary-foreground/10 blur-3xl" />
      <div className="absolute -bottom-28 -left-16 h-80 w-80 rounded-full bg-primary-foreground/10 blur-3xl" />
      <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-foreground/5 blur-3xl" />

      <div className="relative flex items-center gap-2.5 animate-content-in">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-foreground/10">
          <LifeBuoy className="h-5 w-5" />
        </span>
        <span className="text-lg font-semibold tracking-tight">Helpdesk</span>
      </div>

      <p
        className="relative max-w-sm animate-content-in text-3xl font-semibold leading-tight tracking-tight xl:text-4xl"
        style={{ '--stagger-delay': '80ms' } as CSSProperties}
      >
        {tagline}
      </p>

      <ul className="relative flex flex-col gap-5">
        {HIGHLIGHTS.map(({ icon: Icon, label, description }, index) => (
          <li
            key={label}
            className="flex animate-content-in items-start gap-3"
            style={{ '--stagger-delay': `${160 + index * 90}ms` } as CSSProperties}
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/10">
              <Icon className="h-4 w-4" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{label}</span>
              <span className="text-sm text-primary-foreground/70">{description}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
