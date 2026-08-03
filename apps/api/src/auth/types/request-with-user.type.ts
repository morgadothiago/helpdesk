import { Request } from 'express';
import { SanitizedUser } from './sanitized-user.type';

/** `Request` do Express com `user` populado por `JwtStrategy`/`LocalStrategy`. */
export interface RequestWithUser extends Request {
  user: SanitizedUser;
}
