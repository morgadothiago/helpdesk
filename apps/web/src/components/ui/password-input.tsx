import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

/**
 * Campo de senha com botão de "olho" para alternar visibilidade
 * (SPEC-09, item 9.b). Consolida o padrão repetido em `/login` e
 * `/registro` num único componente, em vez de duplicar a lógica de
 * toggle em cada tela.
 *
 * O `<button>` é `type="button"` (nunca dispara submit) e fica dentro do
 * mesmo wrapper relativo do `Input`, sobreposto à direita — não interfere
 * na ordem de tab (input primeiro, botão depois) nem nos atributos
 * `aria-describedby`/`aria-invalid`/`id` já aplicados ao input pelo
 * chamador via `...props`.
 *
 * Ajuste visual (SPEC-09, item 11): o wrapper ganha uma leve escala em
 * `focus-within` (input e botão de olho escalam juntos, sem desalinhar um
 * do outro) — mesma família de microinteração de foco aplicada aos demais
 * campos das telas de autenticação, coberta pela regra global de
 * `prefers-reduced-motion`. Lógica de toggle/acessibilidade inalterada.
 */
const PasswordInput = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);

    return (
      <div className="relative transition-transform duration-200 focus-within:-translate-y-0.5">
        <Input
          type={visible ? 'text' : 'password'}
          className={cn('pr-10', className)}
          ref={ref}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
