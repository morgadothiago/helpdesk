import { Module } from '@nestjs/common';
import { LocalStorageService } from './local-storage.service';
import { STORAGE_SERVICE } from './storage.constants';

/**
 * Seleciona o driver do `StorageService` via `STORAGE_DRIVER` (SPEC-01,
 * seção 3.2). Apenas o driver `local` é implementado nesta SPEC — `blob` é
 * decisão de infraestrutura de produção, fora de escopo (SPEC-03, seção 4).
 * Trocar de driver não deve exigir mudanças em nenhum código de negócio,
 * apenas nesta factory.
 */
@Module({
  providers: [
    {
      provide: STORAGE_SERVICE,
      useFactory: () => {
        const driver = process.env.STORAGE_DRIVER ?? 'local';
        if (driver === 'local') {
          return new LocalStorageService();
        }
        throw new Error(
          `STORAGE_DRIVER="${driver}" não implementado nesta SPEC. Apenas "local" está disponível (SPEC-01 seção 3.2 / SPEC-03 seção 4).`,
        );
      },
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
