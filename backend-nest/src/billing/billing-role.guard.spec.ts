import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

import type { PrismaService } from '../prisma/prisma.service';

import { BillingRoleGuard } from './billing-role.guard';

describe('BillingRoleGuard', () => {
  const context = (user?: unknown) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  it('checks the current database role and tenant before allowing billing writes', async () => {
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue({ id: 'owner-a' }) } };
    const guard = new BillingRoleGuard(prisma as unknown as PrismaService);
    await expect(
      guard.canActivate(context({ id: 'owner-a', workspaceId: 'agency-a', role: 'OWNER' })),
    ).resolves.toBe(true);
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'owner-a', workspaceId: 'agency-a', role: { in: ['OWNER', 'ADMIN'] } },
      }),
    );
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(
      guard.canActivate(context({ id: 'former-admin', workspaceId: 'agency-a', role: 'ADMIN' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { id: 'former-admin', workspaceId: 'agency-a', role: { in: ['OWNER', 'ADMIN'] } } }),
    );
  });

  it('rejects a missing principal without making a database query', async () => {
    const prisma = { user: { findFirst: jest.fn() } };
    const guard = new BillingRoleGuard(prisma as unknown as PrismaService);
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });
});
