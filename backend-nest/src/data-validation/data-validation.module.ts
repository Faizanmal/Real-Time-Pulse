import { Module } from '@nestjs/common';
import { DataValidationService } from './data-validation.service';
import { DataValidationController } from './data-validation.controller';
import { ValidationEngineService } from './validation-engine.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  controllers: [DataValidationController],
  providers: [DataValidationService, ValidationEngineService],
  exports: [DataValidationService, ValidationEngineService],
})
export class DataValidationModule {}
