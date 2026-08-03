import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Dispara a `LocalStrategy` em `POST /auth/login` (RF02). */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
