import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const reflectorMock = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const guard = new RolesGuard(reflectorMock);

  function createContext(user?: { role: string }): ExecutionContext {
    return {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({ user }),
        getResponse: () => ({}),
        getNext: () => undefined,
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows request when route has no role metadata', () => {
    reflectorMock.getAllAndOverride = jest.fn().mockReturnValue(undefined);

    const allowed = guard.canActivate(createContext({ role: 'USER' }));

    expect(allowed).toBe(true);
  });

  it('rejects request when user role is missing from required roles', () => {
    reflectorMock.getAllAndOverride = jest.fn().mockReturnValue(['ADMIN']);

    const allowed = guard.canActivate(createContext({ role: 'USER' }));

    expect(allowed).toBe(false);
  });

  it('allows request when user role matches required roles', () => {
    reflectorMock.getAllAndOverride = jest.fn().mockReturnValue(['ADMIN']);

    const allowed = guard.canActivate(createContext({ role: 'ADMIN' }));

    expect(allowed).toBe(true);
  });
});
