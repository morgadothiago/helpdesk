import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Jest não carrega .env automaticamente. Este setup replica o comportamento
// mínimo necessário para os testes de integração com Postgres local
// encontrarem DATABASE_URL, sem adicionar uma dependência de dotenv.
function loadEnvFile(path: string): void {
  if (!existsSync(path)) {
    return;
  }
  const content = readFileSync(path, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(join(__dirname, '..', '.env'));
