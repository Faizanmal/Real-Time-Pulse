import { HttpModule } from '@nestjs/axios';
import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';

import { DataHealthController } from './data-health.controller';
import { DataHealthService } from './data-health.service';
import { HealthMonitorService } from './health-monitor.service';

@Module({
  imports: [
    PrismaModule,
    HttpModule,
    ScheduleModule.forRoot(),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [DataHealthController],
  providers: [DataHealthService, HealthMonitorService],
  exports: [DataHealthService, HealthMonitorService],
})
export class DataHealthModule {}
