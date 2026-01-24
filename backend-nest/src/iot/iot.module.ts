import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { IoTController } from './iot.controller';
import { IoTDeviceService } from './iot-device.service';
import { EdgeComputingService } from './edge-computing.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot(), EventEmitterModule.forRoot()],
  controllers: [IoTController],
  providers: [IoTDeviceService, EdgeComputingService],
  exports: [IoTDeviceService, EdgeComputingService],
})
export class IoTModule {}
