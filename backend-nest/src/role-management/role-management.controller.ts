import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleManagementService, Permission } from './role-management.service';

@ApiTags('Role Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('roles')
export class RoleManagementController {
  constructor(private readonly roleService: RoleManagementService) {}

  // ==================== Roles ====================

  @Get()
  @ApiOperation({ summary: 'Get all roles' })
  async getRoles(@Request() req: any) {
    return this.roleService.getRoles(req.user.workspaceId);
  }

  @Get('permissions')
  @ApiOperation({ summary: 'Get all available permissions' })
  getPermissions() {
    return this.roleService.getAvailablePermissions();
  }

  @Get(':roleId')
  @ApiOperation({ summary: 'Get a role by ID' })
  @ApiParam({ name: 'roleId', description: 'Role ID' })
  async getRole(@Request() req: any, @Param('roleId') roleId: string) {
    return this.roleService.getRole(req.user.workspaceId, roleId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a custom role' })
  async createRole(
    @Request() req: any,
    @Body()
    dto: {
      name: string;
      description?: string;
      permissions: Permission[];
      parentRoleId?: string;
    },
  ) {
    return this.roleService.createRole(req.user.workspaceId, dto);
  }

  @Put(':roleId')
  @ApiOperation({ summary: 'Update a custom role' })
  @ApiParam({ name: 'roleId', description: 'Role ID' })
  async updateRole(
    @Request() req: any,
    @Param('roleId') roleId: string,
    @Body()
    dto: { name?: string; description?: string; permissions?: Permission[] },
  ) {
    return this.roleService.updateRole(req.user.workspaceId, roleId, dto);
  }

  @Delete(':roleId')
  @ApiOperation({ summary: 'Delete a custom role' })
  @ApiParam({ name: 'roleId', description: 'Role ID' })
  async deleteRole(@Request() req: any, @Param('roleId') roleId: string) {
    await this.roleService.deleteRole(req.user.workspaceId, roleId);
    return { success: true };
  }

  // ==================== Resource Permissions ====================

  @Post('resource-permissions')
  @ApiOperation({ summary: 'Grant resource-level permissions' })
  async grantResourcePermission(
    @Request() req: any,
    @Body()
    dto: {
      userId: string;
      resourceType: 'portal' | 'widget' | 'workspace';
      resourceId: string;
      permissions: Permission[];
      expiresAt?: string;
    },
  ) {
    return this.roleService.grantResourcePermission(
      req.user.workspaceId,
      req.user.id,
      {
        ...dto,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    );
  }

  @Delete('resource-permissions/:userId/:permissionId')
  @ApiOperation({ summary: 'Revoke resource-level permissions' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'permissionId', description: 'Permission ID' })
  async revokeResourcePermission(
    @Request() req: any,
    @Param('userId') userId: string,
    @Param('permissionId') permissionId: string,
  ) {
    await this.roleService.revokeResourcePermission(
      req.user.workspaceId,
      userId,
      permissionId,
      req.user.id,
    );
    return { success: true };
  }

  @Get('resource-permissions/:userId')
  @ApiOperation({ summary: 'Get user resource permissions' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  async getUserResourcePermissions(
    @Request() req: any,
    @Param('userId') userId: string,
  ) {
    return this.roleService.getUserResourcePermissions(
      req.user.workspaceId,
      userId,
    );
  }

  @Post('check-permission')
  @ApiOperation({ summary: 'Check if user has permission' })
  async checkPermission(
    @Request() req: any,
    @Body()
    dto: {
      userId: string;
      permission: Permission;
      resourceType?: 'portal' | 'widget' | 'workspace';
      resourceId?: string;
    },
  ) {
    const hasPermission = await this.roleService.checkPermission(
      req.user.workspaceId,
      dto.userId,
      dto.permission,
      dto.resourceType,
      dto.resourceId,
    );
    return { hasPermission };
  }

  // ==================== Approval Workflows ====================

  @Get('workflows')
  @ApiOperation({ summary: 'Get approval workflows' })
  async getWorkflows(@Request() req: any) {
    return this.roleService.getApprovalWorkflows(req.user.workspaceId);
  }

  @Post('workflows')
  @ApiOperation({ summary: 'Create an approval workflow' })
  async createWorkflow(
    @Request() req: any,
    @Body()
    dto: {
      name: string;
      triggerAction: string;
      requiredApprovers: number;
      approverRoles: string[];
      approverUsers: string[];
      notifyOnRequest: boolean;
      notifyOnApproval: boolean;
      autoApproveAfter?: number;
      isActive: boolean;
    },
  ) {
    return this.roleService.createApprovalWorkflow(req.user.workspaceId, dto);
  }

  @Get('approval-requests')
  @ApiOperation({ summary: 'Get pending approval requests' })
  async getApprovalRequests(@Request() req: any) {
    return this.roleService.getPendingApprovalRequests(req.user.workspaceId);
  }

  @Post('approval-requests')
  @ApiOperation({ summary: 'Create an approval request' })
  async createApprovalRequest(
    @Request() req: any,
    @Body()
    dto: {
      workflowId: string;
      action: string;
      resourceType: string;
      resourceId: string;
      changes: any;
    },
  ) {
    return this.roleService.createApprovalRequest(
      req.user.workspaceId,
      req.user.id,
      dto,
    );
  }

  @Post('approval-requests/:requestId/decide')
  @ApiOperation({ summary: 'Process approval decision' })
  @ApiParam({ name: 'requestId', description: 'Request ID' })
  async processApprovalDecision(
    @Request() req: any,
    @Param('requestId') requestId: string,
    @Body() dto: { decision: 'approved' | 'rejected'; comment?: string },
  ) {
    return this.roleService.processApprovalDecision(
      req.user.workspaceId,
      requestId,
      req.user.id,
      dto.decision,
      dto.comment,
    );
  }

  // ==================== Audit Logs ====================

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get permission audit logs' })
  async getAuditLogs(
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
  ) {
    return this.roleService.getPermissionAuditLogs(req.user.workspaceId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      action,
    });
  }
}
