import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule } from '../prisma/prisma.module';

import { EdgeComputingService } from './edge-computing.service';
import { IoTDeviceService } from './iot-device.service';
import { IoTController } from './iot.controller';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot(), EventEmitterModule.forRoot()],
  controllers: [IoTController],
  providers: [IoTDeviceService, EdgeComputingService],
  exports: [IoTDeviceService, EdgeComputingService],
})
export class IoTModule {}
