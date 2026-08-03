import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { ACCESS_TOKEN_COOKIE } from './constants';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import type { RequestWithUser } from './types/request-with-user.type';
import type { SanitizedUser } from './types/sanitized-user.type';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Cria um novo usuário com role CUSTOMER (RF01).' })
  @ApiResponse({
    status: 201,
    description: 'Usuário criado.',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Email já cadastrado.' })
  register(@Body() dto: RegisterDto): Promise<SanitizedUser> {
    return this.authService.register(dto);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(200)
  @ApiBody({ type: LoginDto })
  @ApiOperation({
    summary:
      'Autentica por email/senha e seta cookie httpOnly com o JWT (RF02).',
  })
  @ApiResponse({
    status: 200,
    description: 'Login bem-sucedido. Dados do usuário sem a senha.',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas.' })
  login(
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ): SanitizedUser {
    const user = req.user;
    const accessToken = this.authService.signAccessToken(user);

    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Retorna os dados do usuário autenticado (RF03).' })
  @ApiResponse({
    status: 200,
    description: 'Usuário autenticado.',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Sem cookie válido.' })
  me(@Req() req: RequestWithUser): SanitizedUser {
    return req.user;
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Limpa o cookie de sessão (RF05, idempotente).' })
  @ApiResponse({ status: 200, description: 'Cookie limpo.' })
  logout(@Res({ passthrough: true }) res: Response): { success: true } {
    res.clearCookie(ACCESS_TOKEN_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    return { success: true };
  }
}
