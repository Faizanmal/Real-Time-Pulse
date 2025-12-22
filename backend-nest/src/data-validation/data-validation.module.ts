import { Module } from '@nestjs/common';
import { DataValidationService } from './data-validation.service';
import { DataValidationController } from './data-validation.controller';
import { ValidationEngineService } from './validation-engine.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ScheduleModule } from '@nestjs/schedule';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot(), EmailModule],
  controllers: [DataValidationController],
  providers: [DataValidationService, ValidationEngineService],
  exports: [DataValidationService, ValidationEngineService],
})
export class DataValidationModule {}
