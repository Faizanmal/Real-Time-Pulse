import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IntegrationService } from './integration.service';
import { IntegrationController } from './integration.controller';
import { AsanaService } from './services/asana.service';
import { GoogleAnalyticsService } from './services/google-analytics.service';
import { HarvestService } from './services/harvest.service';
import { JiraService } from './services/jira.service';
import { TrelloService } from './services/trello.service';
import { GitHubService } from './services/github.service';
import { HubSpotService } from './services/hubspot.service';
import { SlackService } from './services/slack.service';
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
    JiraService,
    TrelloService,
    GitHubService,
    HubSpotService,
    SlackService,
  ],
  exports: [IntegrationService, SlackService],
})
export class IntegrationModule {}
