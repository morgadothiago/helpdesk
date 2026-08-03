// Constantes do AuthModule (SPEC-02).

/** Nome do cookie httpOnly que carrega o JWT emitido no login. */
export const ACCESS_TOKEN_COOKIE = 'access_token';

/** Custo mínimo exigido pela SPEC-02 (seção 7) para o hash bcrypt. */
export const BCRYPT_SALT_ROUNDS = 10;
