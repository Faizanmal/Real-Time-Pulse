import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DataHealthService } from './data-health.service';
import { DataHealthController } from './data-health.controller';
import { HealthMonitorService } from './health-monitor.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsModule } from '../notifications/notifications.module';

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
