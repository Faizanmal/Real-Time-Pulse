import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IntegrationService } from './integration.service';
import { IntegrationController } from './integration.controller';
import { AsanaService } from './services/asana.service';
import { GoogleAnalyticsService } from './services/google-analytics.service';
import { HarvestService } from './services/harvest.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [HttpModule, PrismaModule, JobsModule],
  controllers: [IntegrationController],
  providers: [
    IntegrationService,
    AsanaService,
    GoogleAnalyticsService,
    HarvestService,
  ],
  exports: [IntegrationService],
})
export class IntegrationModule {}
