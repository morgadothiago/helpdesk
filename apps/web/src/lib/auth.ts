import { useEffect, useState } from 'react';
import { API_BASE_URL } from './api-client';

/**
 * Papéis de usuário do domínio de helpdesk (SPEC-01/SPEC-02).
 * Duplicado manualmente de `apps/api/prisma/schema.prisma` (`enum Role`) —
 * um pacote `packages/types` compartilhado é otimização futura, fora de
 * escopo desta SPEC (ver seção 4).
 */
export type Role = 'CUSTOMER' | 'AGENT' | 'ADMIN';

/**
 * Payload de usuário autenticado retornado por `GET /auth/me`.
 * Duplicado manualmente de `apps/api/src/auth/types/sanitized-user.type.ts`
 * (SPEC-02, seção 4: tipagem compartilhada mínima, duplicação manual
 * aceita neste MVP).
 */
export interface AuthenticatedUser {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

/**
 * Busca o usuário autenticado chamando `GET /auth/me` no backend Nest.
 *
 * Retorna `null` quando não há sessão válida (401), em vez de lançar —
 * esse é um estado esperado (usuário deslogado), não um erro de
 * infraestrutura. Qualquer outro status de erro é propagado como exceção.
 *
 * O cookie httpOnly de sessão é enviado automaticamente pelo browser via
 * `credentials: "include"`; esta função não lê nem manipula o cookie
 * diretamente (SPEC-02, seção 3).
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Falha ao buscar usuário autenticado: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as AuthenticatedUser;
}

/**
 * Erro de autenticação com o `status` HTTP original preservado, para que a
 * UI (SPEC-05) possa distinguir "credenciais inválidas" (401) de "email já
 * cadastrado" (409) de falhas genéricas de infraestrutura.
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

/**
 * Autentica por email/senha em `POST /auth/login` (SPEC-02).
 *
 * O cookie httpOnly de sessão é setado pelo Nest na própria resposta; esta
 * função nunca lê/escreve o token diretamente (SPEC-05, seção 6).
 */
export async function login(payload: LoginPayload): Promise<AuthenticatedUser> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 401) {
    throw new AuthError('Email ou senha inválidos.', 401);
  }

  if (!response.ok) {
    throw new AuthError(
      `Falha ao entrar: ${response.status} ${response.statusText}`,
      response.status,
    );
  }

  return (await response.json()) as AuthenticatedUser;
}

/**
 * Cria uma conta (role `CUSTOMER`) em `POST /auth/register` (SPEC-02).
 *
 * Não autentica automaticamente: o backend não seta cookie nesta resposta,
 * então a UI deve direcionar o usuário para `/login` em seguida.
 */
export async function register(
  payload: RegisterPayload,
): Promise<AuthenticatedUser> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 409) {
    throw new AuthError('Este email já está cadastrado.', 409);
  }

  if (!response.ok) {
    throw new AuthError(
      `Falha ao criar conta: ${response.status} ${response.statusText}`,
      response.status,
    );
  }

  return (await response.json()) as AuthenticatedUser;
}

/**
 * Encerra a sessão chamando `POST /auth/logout` (limpa o cookie httpOnly no
 * backend). Idempotente no backend; aqui apenas propaga falhas reais de
 * infraestrutura.
 */
export async function logout(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new AuthError(
      `Falha ao encerrar sessão: ${response.status} ${response.statusText}`,
      response.status,
    );
  }
}

/**
 * Rota inicial pós-login, de acordo com o papel do usuário (SPEC-05, RF02).
 */
export function homePathForRole(role: Role): string {
  return role === 'CUSTOMER' ? '/tickets' : '/painel-agente';
}

export interface UseSessionResult {
  /** Usuário autenticado, ou `null` se não houver sessão válida. */
  user: AuthenticatedUser | null;
  /** `true` enquanto a chamada a `GET /auth/me` está em andamento. */
  isLoading: boolean;
  /** Erro de infraestrutura ao buscar a sessão (não inclui 401). */
  error: Error | null;
}

/**
 * Hook client-side que hidrata a sessão do usuário chamando
 * `GET /auth/me` (SPEC-02, seção 8).
 *
 * Não guarda nada em `localStorage`: o estado vive apenas em memória de
 * componente, reconstruído a partir do cookie httpOnly a cada montagem.
 */
export function useSession(): UseSessionResult {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    getCurrentUser()
      .then((currentUser) => {
        if (isMounted) {
          setUser(currentUser);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setUser(null);
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return { user, isLoading, error };
}
