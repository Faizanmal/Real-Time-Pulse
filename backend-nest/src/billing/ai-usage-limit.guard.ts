import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { BillingService } from './billing.service';

@Injectable()
export class AiUsageLimitGuard implements CanActivate {
  constructor(private readonly billing: BillingService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: { workspaceId?: string } }>();
    const workspaceId = request.user?.workspaceId;
    if (!workspaceId) return false;
    await this.billing.consumeAiRequest(workspaceId);
    return true;
  }
}
