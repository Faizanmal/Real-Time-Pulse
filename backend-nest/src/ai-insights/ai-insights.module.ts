import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AIInsightsController } from './ai-insights.controller';
import { AIInsightsService } from './ai-insights.service';
import { EnhancedAIService } from './enhanced-ai.service';
import { ConversationalAIService } from './conversational-ai.service';
import { ConversationalAIController } from './conversational-ai.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, EventEmitterModule.forRoot()],
  controllers: [AIInsightsController, ConversationalAIController],
  providers: [AIInsightsService, EnhancedAIService, ConversationalAIService],
  exports: [AIInsightsService, EnhancedAIService, ConversationalAIService],
})
export class AIInsightsModule {}
