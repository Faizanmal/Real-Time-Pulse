import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { BillingModule } from '../billing/billing.module';
import { PrismaModule } from '../prisma/prisma.module';

import { AIInsightsController } from './ai-insights.controller';
import { AIInsightsService } from './ai-insights.service';
import { ConversationalAIController } from './conversational-ai.controller';
import { ConversationalAIService } from './conversational-ai.service';
import { EnhancedAIService } from './enhanced-ai.service';

@Module({
  imports: [PrismaModule, BillingModule, EventEmitterModule.forRoot()],
  controllers: [AIInsightsController, ConversationalAIController],
  providers: [AIInsightsService, EnhancedAIService, ConversationalAIService],
  exports: [AIInsightsService, EnhancedAIService, ConversationalAIService],
})
export class AIInsightsModule {}
