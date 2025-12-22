import { Module } from '@nestjs/common';
import { WorkflowAutomationController } from './workflow-automation.controller';
import { WorkflowAutomationService } from './workflow-automation.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WorkflowAutomationController],
  providers: [WorkflowAutomationService],
  exports: [WorkflowAutomationService],
})
export class WorkflowAutomationModule {}
