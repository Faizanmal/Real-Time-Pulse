import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { RequestUser } from '../interfaces/auth.interface';

interface ThrottlerRequest {
  user?: RequestUser;
  ip: string;
}

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: ThrottlerRequest): Promise<string> {
    // Use user ID for authenticated requests, IP for anonymous
    return Promise.resolve(req.user?.id || req.ip);
  }
}
