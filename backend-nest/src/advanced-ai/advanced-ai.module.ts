import { Module } from '@nestjs/common';
import { AdvancedAiController } from './advanced-ai.controller';
import { AdvancedAiService } from './advanced-ai.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdvancedAiController],
  providers: [AdvancedAiService],
  exports: [AdvancedAiService],
})
export class AdvancedAiModule {}
