import { Module } from '@nestjs/common';

import { CacheModule } from '../cache/cache.module';
import { PrismaModule } from '../prisma/prisma.module';

import { PermissionGuard } from './guards/permission.guard';
import { RoleManagementController } from './role-management.controller';
import { RoleManagementService } from './role-management.service';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [RoleManagementController],
  providers: [RoleManagementService, PermissionGuard],
  exports: [RoleManagementService, PermissionGuard],
})
export class RoleManagementModule {}
