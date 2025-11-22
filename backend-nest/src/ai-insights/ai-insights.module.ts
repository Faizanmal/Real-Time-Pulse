import { Module } from '@nestjs/common';
import { AIInsightsController } from './ai-insights.controller';
import { AIInsightsService } from './ai-insights.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AIInsightsController],
  providers: [AIInsightsService],
  exports: [AIInsightsService],
})
export class AIInsightsModule {}
