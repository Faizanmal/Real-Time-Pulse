import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';

import { ClientReportController } from './client-report.controller';
import { ClientReportService } from './client-report.service';
import { ReportGeneratorService } from './report-generator.service';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot(), HttpModule, EmailModule],
  controllers: [ClientReportController],
  providers: [ClientReportService, ReportGeneratorService],
  exports: [ClientReportService, ReportGeneratorService],
})
export class ClientReportModule {}
