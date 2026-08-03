'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getHealth } from '@/lib/api-client';

export default function Home() {
  const [apiStatus, setApiStatus] = useState<string>('Verificando API...');

  useEffect(() => {
    getHealth()
      .then((health) => setApiStatus(`API respondeu: ${health.status}`))
      .catch((error: unknown) =>
        setApiStatus(
          `Falha ao conectar com a API: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      );
  }, []);

  return (
    <div className="flex flex-col flex-1 items-center justify-center gap-6 bg-zinc-50 font-sans dark:bg-black">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
        Helpdesk
      </h1>
      <p data-testid="api-health-status" className="text-zinc-600 dark:text-zinc-400">
        {apiStatus}
      </p>
      <Button>Exemplo shadcn/ui</Button>
    </div>
  );
}
