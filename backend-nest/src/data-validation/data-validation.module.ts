import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { CacheModule } from '../cache/cache.module';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';

import { DataValidationController } from './data-validation.controller';
import { DataValidationService } from './data-validation.service';
import { ValidationEngineService } from './validation-engine.service';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot(), EmailModule, CacheModule],
  controllers: [DataValidationController],
  providers: [DataValidationService, ValidationEngineService],
  exports: [DataValidationService, ValidationEngineService],
})
export class DataValidationModule {}
