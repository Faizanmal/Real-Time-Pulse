import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { AuthModule } from '../auth/auth.module';
import { AgencyRoleGuard } from '../auth/guards/agency-role.guard';
import { BillingRoleGuard } from '../billing/billing-role.guard';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ShareLinksModule } from '../share-links/share-links.module';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

import { ClientReportController } from './client-report.controller';
import { ClientReportPublicController } from './client-report-public.controller';
import { ClientReportService } from './client-report.service';
import { ReportGeneratorService } from './report-generator.service';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot(), HttpModule, EmailModule, AuthModule, ShareLinksModule],
  controllers: [ClientReportController, ClientReportPublicController],
  providers: [ClientReportService, ReportGeneratorService, AgencyRoleGuard, BillingRoleGuard, OptionalJwtAuthGuard],
  exports: [ClientReportService, ReportGeneratorService],
})
export class ClientReportModule {}
