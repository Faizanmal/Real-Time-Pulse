import { Module } from '@nestjs/common';

import { EmailModule } from '../email/email.module';
import { AgencyRoleGuard } from '../auth/guards/agency-role.guard';

import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';

@Module({
  imports: [EmailModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, AgencyRoleGuard],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
