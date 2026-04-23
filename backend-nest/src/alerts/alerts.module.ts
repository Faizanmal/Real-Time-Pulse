import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';

import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

@Module({
  imports: [PrismaModule, EmailModule, HttpModule],
  controllers: [AlertsController],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
