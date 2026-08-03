import { rm } from 'fs/promises';
import { join } from 'path';
import { NotFoundException } from '@nestjs/common';
import { LocalStorageService } from './local-storage.service';

/**
 * Testes do driver `local` do `StorageService` (SPEC-01, seção 3.2 / SPEC-03
 * seção 3): upload/getUrl/delete/getFileStream, usando um diretório de
 * uploads isolado (não `apps/api/uploads/`) para não sujar o diretório real.
 */
describe('LocalStorageService', () => {
  const testUploadsDir = join(__dirname, '__test-uploads__');
  let service: LocalStorageService;

  beforeEach(() => {
    service = new LocalStorageService(testUploadsDir);
  });

  afterAll(async () => {
    await rm(testUploadsDir, { recursive: true, force: true });
  });

  it('faz upload do arquivo e retorna uma storageKey', async () => {
    const storageKey = await service.upload({
      buffer: Buffer.from('conteudo de teste'),
      originalName: 'arquivo de teste.txt',
      mimeType: 'text/plain',
    });

    expect(storageKey).toBeDefined();
    expect(storageKey).toContain('arquivo_de_teste.txt');
  });

  it('getUrl retorna uma referência interna (driver local não é público)', () => {
    expect(service.getUrl('alguma-chave')).toBe('local://alguma-chave');
  });

  it('getFileStream lê de volta o conteúdo persistido pelo upload', async () => {
    const content = 'conteudo lido de volta';
    const storageKey = await service.upload({
      buffer: Buffer.from(content),
      originalName: 'leitura.txt',
      mimeType: 'text/plain',
    });

    const stream = await service.getFileStream(storageKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    expect(Buffer.concat(chunks).toString('utf-8')).toBe(content);
  });

  it('getFileStream rejeita com NotFoundException para storageKey inexistente', async () => {
    await expect(service.getFileStream('nao-existe')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('delete remove o arquivo (leitura subsequente falha)', async () => {
    const storageKey = await service.upload({
      buffer: Buffer.from('a apagar'),
      originalName: 'apagar.txt',
      mimeType: 'text/plain',
    });

    await service.delete(storageKey);

    await expect(service.getFileStream(storageKey)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('delete é resiliente a arquivo inexistente (não lança)', async () => {
    await expect(service.delete('nunca-existiu')).resolves.toBeUndefined();
  });
});
