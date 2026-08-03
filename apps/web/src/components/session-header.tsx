'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { logout, useSession } from '@/lib/auth';

/**
 * Cabeçalho de sessão (SPEC-05, seção 3): exibe o usuário autenticado (via
 * `useSession`, que chama `GET /auth/me`) e o botão de logout, ou links de
 * entrar/criar conta quando não há sessão. Sem `SessionProvider`/Auth.js —
 * hidratação simples via hook client-side.
 */
export function SessionHeader() {
  const { user, isLoading } = useSession();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      router.push('/login');
    }
  }

  return (
    <header className="flex items-center justify-between border-b border-border bg-background px-4 py-3 sm:px-6">
      <Link href="/" className="text-sm font-semibold text-foreground">
        Helpdesk
      </Link>

      <nav className="flex items-center gap-3" aria-label="Sessão">
        {isLoading ? null : user ? (
          <>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Olá, {user.name ?? user.email}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? 'Saindo...' : 'Sair'}
            </Button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Entrar
            </Link>
            <Link
              href="/registro"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Criar conta
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
