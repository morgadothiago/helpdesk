const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface ApiClientOptions extends RequestInit {
  /** Caminho relativo à raiz da API, ex.: "/health". */
  path: string;
}

/**
 * Wrapper mínimo sobre fetch para chamar a API Nest.
 *
 * Sempre envia `credentials: "include"` (SPEC-02, seção 8) para que o
 * cookie httpOnly setado pelo backend Nest em `POST /auth/login` seja
 * repassado automaticamente pelo browser nas chamadas subsequentes. O
 * CORS do Nest (SPEC-00/SPEC-02) já está configurado com
 * `credentials: true` e origem explícita.
 */
export async function apiFetch<T>({
  path,
  ...init
}: ApiClientOptions): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Falha ao chamar ${path}: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as T;
}

export interface HealthResponse {
  status: 'ok';
}

export function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>({ path: '/health' });
}

export { API_BASE_URL };
