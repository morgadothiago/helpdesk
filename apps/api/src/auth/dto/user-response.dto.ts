import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

/**
 * Formato de usuário devolvido por `/auth/register`, `/auth/login` e
 * `/auth/me`. Usado apenas para documentação Swagger — os controllers
 * retornam `SanitizedUser` (ver `types/sanitized-user.type.ts`), que tem o
 * mesmo formato.
 */
export class UserResponseDto {
  @ApiProperty({ example: 'clx1y2z3a0000qzrmn8j5k7f1' })
  id!: string;

  @ApiProperty({ example: 'Cliente Exemplo', nullable: true })
  name!: string | null;

  @ApiProperty({ example: 'cliente@example.com' })
  email!: string;

  @ApiProperty({ enum: Role, example: Role.CUSTOMER })
  role!: Role;

  @ApiProperty({ example: '2026-08-03T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-08-03T12:00:00.000Z' })
  updatedAt!: Date;
}
