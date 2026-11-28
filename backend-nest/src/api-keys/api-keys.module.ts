import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AgencyRoleGuard } from '../auth/guards/agency-role.guard';

import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService, AgencyRoleGuard],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
