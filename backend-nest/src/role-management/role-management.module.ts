import { Module } from '@nestjs/common';
import { RoleManagementService } from './role-management.service';
import { RoleManagementController } from './role-management.controller';
import { PermissionGuard } from './guards/permission.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [RoleManagementController],
  providers: [RoleManagementService, PermissionGuard],
  exports: [RoleManagementService, PermissionGuard],
})
export class RoleManagementModule {}
