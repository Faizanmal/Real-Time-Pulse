import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AIInsightsController } from './ai-insights.controller';
import { AIInsightsService } from './ai-insights.service';
import { EnhancedAIService } from './enhanced-ai.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, EventEmitterModule.forRoot()],
  controllers: [AIInsightsController],
  providers: [AIInsightsService, EnhancedAIService],
  exports: [AIInsightsService, EnhancedAIService],
})
export class AIInsightsModule {}
