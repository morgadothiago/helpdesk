import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiPropertyOptional({ example: 'Cliente Exemplo' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'cliente@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'senha-forte-123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}
