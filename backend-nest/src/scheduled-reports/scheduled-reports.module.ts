import { Module } from '@nestjs/common';
import { ScheduledReportsService } from './scheduled-reports.service';
import { ScheduledReportsController } from './scheduled-reports.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JobsModule } from '../jobs/jobs.module';
import { EmailModule } from '../email/email.module';
import { ExportModule } from '../exports/export.module';

@Module({
  imports: [PrismaModule, JobsModule, EmailModule, ExportModule],
  controllers: [ScheduledReportsController],
  providers: [ScheduledReportsService],
  exports: [ScheduledReportsService],
})
export class ScheduledReportsModule {}
