import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AlertsModule } from '../alerts/alerts.module';

import { JobsService } from './jobs.service';
import { SyncProviderService } from './sync-provider.service';
import { DataSyncQueueProcessor } from './processors/data-sync-queue.processor';
import { EmailQueueProcessor } from './processors/email-queue.processor';
import { ReportQueueProcessor } from './processors/report-queue.processor';
import { QUEUE_NAMES } from './queue.constants';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        ({
          redis: {
            host: configService.get<string>('redis.host'),
            port: configService.get<number>('redis.port'),
            password: configService.get<string>('redis.password'),
          },
        }) as any,
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.EMAIL },
      { name: QUEUE_NAMES.REPORT },
      { name: QUEUE_NAMES.DATA_SYNC },
      { name: QUEUE_NAMES.ANALYTICS },
    ),
    HttpModule,
    EmailModule,
    PrismaModule,
    AnalyticsModule,
    AnalyticsModule,
    AlertsModule,
  ],
  providers: [JobsService, SyncProviderService, EmailQueueProcessor, ReportQueueProcessor, DataSyncQueueProcessor],
  exports: [JobsService, BullModule],
})
export class JobsModule {}
