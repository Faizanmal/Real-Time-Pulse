import { Module } from '@nestjs/common';
import { ClientReportService } from './client-report.service';
import { ClientReportController } from './client-report.controller';
import { ReportGeneratorService } from './report-generator.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot(), HttpModule, EmailModule],
  controllers: [ClientReportController],
  providers: [ClientReportService, ReportGeneratorService],
  exports: [ClientReportService, ReportGeneratorService],
})
export class ClientReportModule {}
