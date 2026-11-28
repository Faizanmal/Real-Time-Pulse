import { Module } from '@nestjs/common';

import { BillingModule } from '../billing/billing.module';
import { PrismaModule } from '../prisma/prisma.module';

import { AdvancedAiController } from './advanced-ai.controller';
import { AdvancedAiService } from './advanced-ai.service';

@Module({
  imports: [PrismaModule, BillingModule],
  controllers: [AdvancedAiController],
  providers: [AdvancedAiService],
  exports: [AdvancedAiService],
})
export class AdvancedAiModule {}
