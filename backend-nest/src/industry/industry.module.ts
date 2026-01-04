import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { IndustryController } from './industry.controller';
import { HealthcareSolutionService } from './healthcare/healthcare-solution.service';
import { FinanceSolutionService } from './finance/finance-solution.service';
import { ManufacturingSolutionService } from './manufacturing/manufacturing-solution.service';
import { RetailSolutionService } from './retail/retail-solution.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    EventEmitterModule.forRoot(),
  ],
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
