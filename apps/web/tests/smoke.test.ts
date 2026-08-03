import { describe, expect, it, vi, afterEach } from 'vitest';
import { getHealth } from '@/lib/api-client';

describe('api-client smoke test - GET /health', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('calls GET /health on the configured API base URL and returns the status', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ status: 'ok' }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await getHealth();

    expect(result).toEqual({ status: 'ok' });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/health'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('throws a descriptive error when the API responds with a non-ok status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({}),
    }) as unknown as typeof fetch;

    await expect(getHealth()).rejects.toThrow(/Falha ao chamar \/health/);
  });
});
