import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { WorkflowAutomationController } from './workflow-automation.controller';
import { WorkflowAutomationService } from './workflow-automation.service';

@Module({
  imports: [PrismaModule],
  controllers: [WorkflowAutomationController],
  providers: [WorkflowAutomationService],
  exports: [WorkflowAutomationService],
})
export class WorkflowAutomationModule {}
