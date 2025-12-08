import { Module } from '@nestjs/common';
import { ProfitabilityService } from './profitability.service';
import { ProfitabilityController } from './profitability.controller';
import { ProjectService } from './project.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  controllers: [ProfitabilityController],
  providers: [ProfitabilityService, ProjectService],
  exports: [ProfitabilityService, ProjectService],
})
export class ProfitabilityModule {}
