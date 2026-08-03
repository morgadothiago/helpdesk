import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'cliente@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'senha-forte-123' })
  @IsString()
  @MinLength(1)
  password!: string;
}
