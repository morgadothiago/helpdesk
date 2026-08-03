const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface ApiClientOptions extends RequestInit {
  /** Caminho relativo à raiz da API, ex.: "/health". */
  path: string;
}

/**
 * Wrapper mínimo sobre fetch para chamar a API Nest.
 * Sem lógica de autenticação/negócio — isso é escopo da SPEC-02 em diante.
 */
export async function apiFetch<T>({
  path,
  ...init
}: ApiClientOptions): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
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
