import { ForbiddenException } from '@nestjs/common';

import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard client workspace policy', () => {
  const guard = new JwtAuthGuard() as any;
  const contextFor = (method: string, path: string) => ({
    switchToHttp: () => ({ getRequest: () => ({ method, path }) }),
  });

  it('blocks client accounts from workspace APIs while allowing session self-service', () => {
    expect(() => guard.handleRequest(null, { id: 'client-a', role: 'MEMBER' }, null, contextFor('GET', '/api/v1/portals')))
      .toThrow(ForbiddenException);
    expect(guard.handleRequest(null, { id: 'client-a', role: 'MEMBER' }, null, contextFor('GET', '/api/v1/auth/me')).id)
      .toBe('client-a');
    expect(guard.handleRequest(null, { id: 'client-a', role: 'MEMBER' }, null, contextFor('POST', '/api/v1/auth/logout')).id)
      .toBe('client-a');
  });
});
