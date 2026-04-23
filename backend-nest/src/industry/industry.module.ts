import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { PrismaModule } from '../prisma/prisma.module';

import { FinanceSolutionService } from './finance/finance-solution.service';
import { HealthcareSolutionService } from './healthcare/healthcare-solution.service';
import { IndustryController } from './industry.controller';
import { ManufacturingSolutionService } from './manufacturing/manufacturing-solution.service';
import { RetailSolutionService } from './retail/retail-solution.service';

@Module({
  imports: [PrismaModule, EventEmitterModule.forRoot()],
  controllers: [IndustryController],
  providers: [
    HealthcareSolutionService,
    FinanceSolutionService,
    ManufacturingSolutionService,
    RetailSolutionService,
  ],
  exports: [
    HealthcareSolutionService,
    FinanceSolutionService,
    ManufacturingSolutionService,
    RetailSolutionService,
  ],
})
export class IndustryModule {}
