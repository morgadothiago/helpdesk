import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Testa `RolesGuard` (RF04, SPEC-02 seção 10): libera papel autorizado e
 * bloqueia (403) papel não autorizado. Testado isoladamente da camada HTTP
 * porque `RolesGuard`/`@Roles()` são infraestrutura reutilizável — as rotas
 * de negócio que efetivamente os usam pertencem às SPECs 03/04.
 */
describe('RolesGuard', () => {
  function createContext(role: Role | undefined): ExecutionContext {
    const request = { user: role ? { id: 'user-1', role } : undefined };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  }

  function createGuard(requiredRoles: Role[] | undefined): RolesGuard {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(requiredRoles),
    } as unknown as Reflector;
    return new RolesGuard(reflector);
  }

  it('libera a requisição quando a rota não declara @Roles()', () => {
    const guard = createGuard(undefined);
    expect(guard.canActivate(createContext(Role.CUSTOMER))).toBe(true);
  });

  it('libera a requisição quando o papel do usuário está entre os exigidos', () => {
    const guard = createGuard([Role.AGENT, Role.ADMIN]);
    expect(guard.canActivate(createContext(Role.AGENT))).toBe(true);
  });

  it('bloqueia com ForbiddenException (403) quando o papel não está autorizado', () => {
    const guard = createGuard([Role.AGENT, Role.ADMIN]);
    expect(() => guard.canActivate(createContext(Role.CUSTOMER))).toThrow(
      ForbiddenException,
    );
  });

  it('bloqueia com ForbiddenException (403) quando não há usuário no request', () => {
    const guard = createGuard([Role.AGENT]);
    expect(() => guard.canActivate(createContext(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('reflector consulta metadata do ROLES_KEY (contrato com @Roles())', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Role.ADMIN]),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);
    guard.canActivate(createContext(Role.ADMIN));
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      ROLES_KEY,
      expect.any(Array),
    );
  });
});
