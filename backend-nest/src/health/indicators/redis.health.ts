import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';

import { RedisService } from '../../cache/redis.service';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly redis: RedisService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  isHealthy(key: string) {
    return this.healthIndicatorService.check(key).attempt(async () => {
      const client = this.redis.getClient();
      await client.ping();
    });
  }
}
