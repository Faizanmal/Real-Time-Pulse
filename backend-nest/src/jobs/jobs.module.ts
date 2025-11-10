import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { EmailQueueProcessor } from './processors/email-queue.processor';
import { ReportQueueProcessor } from './processors/report-queue.processor';
import { DataSyncQueueProcessor } from './processors/data-sync-queue.processor';
import { JobsService } from './jobs.service';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';

export const QUEUE_NAMES = {
  EMAIL: 'email',
  REPORT: 'report',
  DATA_SYNC: 'data-sync',
  ANALYTICS: 'analytics',
} as const;

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get<string>('redis.password'),
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.EMAIL },
      { name: QUEUE_NAMES.REPORT },
      { name: QUEUE_NAMES.DATA_SYNC },
      { name: QUEUE_NAMES.ANALYTICS },
    ),
    EmailModule,
    PrismaModule,
  ],
  providers: [
    JobsService,
    EmailQueueProcessor,
    ReportQueueProcessor,
    DataSyncQueueProcessor,
  ],
  exports: [JobsService, BullModule],
})
export class JobsModule {}
