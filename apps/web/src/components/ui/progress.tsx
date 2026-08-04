import { cn } from '@/lib/utils';

/**
 * Barra de progresso simples (sem dependência de `@radix-ui/react-progress`,
 * ausente do projeto) usada para feedback de upload de anexo (SPEC-09,
 * seção 4/Finding 1 do QA). `value` em porcentagem (0-100); `undefined`
 * renderiza um estado indeterminado (animação de preenchimento contínua)
 * para os poucos navegadores/ambientes onde `XMLHttpRequest.upload.onprogress`
 * não reporta `lengthComputable` (ex.: corpo sem `Content-Length`
 * conhecido).
 *
 * Semântica de acessibilidade nativa via `role="progressbar"` +
 * `aria-valuenow`/`aria-valuemin`/`aria-valuemax` (ou `aria-valuetext`
 * "Enviando..." no estado indeterminado), sem depender apenas da cor.
 * Respeita `prefers-reduced-motion` através da regra global já existente em
 * `globals.css` (zera `transition-duration`/`animation-duration`).
 */
export function Progress({
  value,
  className,
  label,
}: {
  value?: number;
  className?: string;
  label?: string;
}) {
  const isDeterminate = typeof value === 'number' && Number.isFinite(value);
  const clamped = isDeterminate
    ? Math.min(100, Math.max(0, value as number))
    : undefined;

  return (
    <div
      role="progressbar"
      aria-label={label ?? 'Enviando arquivo'}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-valuetext={isDeterminate ? `${Math.round(clamped!)}%` : 'Enviando...'}
      className={cn(
        'h-2 w-full overflow-hidden rounded-full bg-secondary',
        className,
      )}
    >
      <div
        className={cn(
          'h-full rounded-full bg-primary transition-[width] duration-200 ease-out',
          !isDeterminate && 'w-1/3 animate-[progress-indeterminate_1.2s_ease-in-out_infinite]',
        )}
        style={isDeterminate ? { width: `${clamped}%` } : undefined}
      />
    </div>
  );
}
