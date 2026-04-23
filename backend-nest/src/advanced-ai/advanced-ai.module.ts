import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { AdvancedAiController } from './advanced-ai.controller';
import { AdvancedAiService } from './advanced-ai.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdvancedAiController],
  providers: [AdvancedAiService],
  exports: [AdvancedAiService],
})
export class AdvancedAiModule {}
