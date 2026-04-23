import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule } from '../prisma/prisma.module';

import { ComplianceService } from './compliance.service';
import { GdprController } from './gdpr.controller';
import { GdprService } from './gdpr.service';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  controllers: [GdprController],
  providers: [GdprService, ComplianceService],
  exports: [GdprService, ComplianceService],
})
export class GdprModule {}
