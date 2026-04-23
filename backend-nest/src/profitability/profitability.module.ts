import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule } from '../prisma/prisma.module';

import { ProfitabilityController } from './profitability.controller';
import { ProfitabilityService } from './profitability.service';
import { ProjectService } from './project.service';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  controllers: [ProfitabilityController],
  providers: [ProfitabilityService, ProjectService],
  exports: [ProfitabilityService, ProjectService],
})
export class ProfitabilityModule {}
