import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

import type { RequestUser } from '../common/interfaces/auth.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BillingRoleGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Authentication required');
    const authorized = await this.prisma.user.findFirst({
      where: { id: user.id, workspaceId: user.workspaceId, role: { in: ['OWNER', 'ADMIN'] } },
      select: { id: true },
    });
    if (!authorized) throw new ForbiddenException('Owner or admin role required to manage billing');
    return true;
  }
}
