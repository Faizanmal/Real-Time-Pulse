import { Module } from '@nestjs/common';

import { EmailModule } from '../email/email.module';
import { ExportModule } from '../exports/export.module';
import { JobsModule } from '../jobs/jobs.module';
import { PrismaModule } from '../prisma/prisma.module';

import { ScheduledReportsController } from './scheduled-reports.controller';
import { ScheduledReportsService } from './scheduled-reports.service';

@Module({
  imports: [PrismaModule, JobsModule, EmailModule, ExportModule],
  controllers: [ScheduledReportsController],
  providers: [ScheduledReportsService],
  exports: [ScheduledReportsService],
})
export class ScheduledReportsModule {}
