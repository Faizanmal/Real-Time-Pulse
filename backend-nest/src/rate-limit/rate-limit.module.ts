import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { RateLimitController } from './rate-limit.controller';
import { RateLimitService } from './rate-limit.service';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'api-requests',
    }),
  ],
  controllers: [RateLimitController],
  providers: [RateLimitService],
  exports: [RateLimitService],
})
export class RateLimitModule {}
