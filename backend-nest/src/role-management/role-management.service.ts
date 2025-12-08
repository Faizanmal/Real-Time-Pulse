import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

// Permission definitions
export const PERMISSIONS = {
  // Portal permissions
  'portal:view': 'View portals',
  'portal:create': 'Create portals',
  'portal:edit': 'Edit portals',
  'portal:delete': 'Delete portals',
  'portal:share': 'Share portals',
  'portal:publish': 'Publish/unpublish portals',

  // Widget permissions
  'widget:view': 'View widgets',
  'widget:create': 'Create widgets',
  'widget:edit': 'Edit widgets',
  'widget:delete': 'Delete widgets',

  // Workspace permissions
  'workspace:view': 'View workspace settings',
  'workspace:edit': 'Edit workspace settings',
  'workspace:manage_members': 'Manage workspace members',
  'workspace:manage_roles': 'Manage roles and permissions',
  'workspace:manage_billing': 'Manage billing',

  // Integration permissions
  'integration:view': 'View integrations',
  'integration:create': 'Create integrations',
  'integration:edit': 'Edit integrations',
  'integration:delete': 'Delete integrations',

  // Report permissions
  'report:view': 'View reports',
  'report:create': 'Create reports',
  'report:schedule': 'Schedule reports',
  'report:export': 'Export data',

  // AI permissions
  'ai:insights': 'View AI insights',
  'ai:query': 'Use AI queries',

  // Admin permissions
  'admin:audit_logs': 'View audit logs',
  'admin:analytics': 'View admin analytics',
  'admin:settings': 'Manage system settings',
} as const;

export type Permission = keyof typeof PERMISSIONS;

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  isSystem: boolean;
  parentRoleId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResourcePermission {
  id: string;
  userId: string;
  resourceType: 'portal' | 'widget' | 'workspace';
  resourceId: string;
  permissions: Permission[];
  grantedBy: string;
  grantedAt: Date;
  expiresAt?: Date;
}

export interface ApprovalWorkflow {
  id: string;
  workspaceId: string;
  name: string;
  triggerAction: string;
  requiredApprovers: number;
  approverRoles: string[];
  approverUsers: string[];
  notifyOnRequest: boolean;
  notifyOnApproval: boolean;
  autoApproveAfter?: number; // hours
  isActive: boolean;
}

export interface ApprovalRequest {
  id: string;
  workflowId: string;
  requesterId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes: any;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  approvals: Array<{
    userId: string;
    decision: 'approved' | 'rejected';
    comment?: string;
    timestamp: Date;
  }>;
  createdAt: Date;
  expiresAt?: Date;
}

@Injectable()
export class RoleManagementService {
  private readonly logger = new Logger(RoleManagementService.name);

  // Default system roles
  private readonly systemRoles: Role[] = [
    {
      id: 'role_owner',
      name: 'Owner',
      description: 'Full access to all features',
      permissions: Object.keys(PERMISSIONS) as Permission[],
      isSystem: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'role_admin',
      name: 'Admin',
      description: 'Administrative access',
      permissions: [
        'portal:view',
        'portal:create',
        'portal:edit',
        'portal:delete',
        'portal:share',
        'portal:publish',
        'widget:view',
        'widget:create',
        'widget:edit',
        'widget:delete',
        'workspace:view',
        'workspace:edit',
        'workspace:manage_members',
        'integration:view',
        'integration:create',
        'integration:edit',
        'integration:delete',
        'report:view',
        'report:create',
        'report:schedule',
        'report:export',
        'ai:insights',
        'ai:query',
        'admin:audit_logs',
        'admin:analytics',
      ],
      isSystem: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'role_editor',
      name: 'Editor',
      description: 'Can create and edit content',
      permissions: [
        'portal:view',
        'portal:create',
        'portal:edit',
        'portal:share',
        'widget:view',
        'widget:create',
        'widget:edit',
        'integration:view',
        'report:view',
        'report:create',
        'report:export',
        'ai:insights',
        'ai:query',
      ],
      isSystem: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'role_viewer',
      name: 'Viewer',
      description: 'Read-only access',
      permissions: [
        'portal:view',
        'widget:view',
        'integration:view',
        'report:view',
        'ai:insights',
      ],
      isSystem: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ==================== Role Management ====================

  /**
   * Get all roles for a workspace
   */
  async getRoles(workspaceId: string): Promise<Role[]> {
    const customRolesJson = await this.cache.get(`roles:${workspaceId}`);
    const customRoles: Role[] = customRolesJson
      ? JSON.parse(customRolesJson)
      : [];
    return [...this.systemRoles, ...customRoles];
  }

  /**
   * Get a role by ID
   */
  async getRole(workspaceId: string, roleId: string): Promise<Role> {
    // Check system roles first
    const systemRole = this.systemRoles.find((r) => r.id === roleId);
    if (systemRole) return systemRole;

    // Check custom roles
    const roles = await this.getRoles(workspaceId);
    const role = roles.find((r) => r.id === roleId);

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  /**
   * Create a custom role
   */
  async createRole(
    workspaceId: string,
    data: {
      name: string;
      description?: string;
      permissions: Permission[];
      parentRoleId?: string;
    },
  ): Promise<Role> {
    // Validate permissions
    for (const perm of data.permissions) {
      if (!PERMISSIONS[perm]) {
        throw new BadRequestException(`Invalid permission: ${perm}`);
      }
    }

    // If parent role specified, inherit permissions
    let permissions = data.permissions;
    if (data.parentRoleId) {
      const parentRole = await this.getRole(workspaceId, data.parentRoleId);
      permissions = [
        ...new Set([...parentRole.permissions, ...data.permissions]),
      ];
    }

    const roleId = `role_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const role: Role = {
      id: roleId,
      name: data.name,
      description: data.description,
      permissions,
      parentRoleId: data.parentRoleId,
      isSystem: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save role
    const customRolesJson = await this.cache.get(`roles:${workspaceId}`);
    const customRoles: Role[] = customRolesJson
      ? JSON.parse(customRolesJson)
      : [];
    customRoles.push(role);

    await this.cache.set(
      `roles:${workspaceId}`,
      JSON.stringify(customRoles),
      86400 * 365,
    );

    // Log audit
    await this.logPermissionChange(workspaceId, {
      action: 'role_created',
      roleId,
      roleName: role.name,
      permissions: role.permissions,
    });

    return role;
  }

  /**
   * Update a custom role
   */
  async updateRole(
    workspaceId: string,
    roleId: string,
    data: {
      name?: string;
      description?: string;
      permissions?: Permission[];
    },
  ): Promise<Role> {
    const role = await this.getRole(workspaceId, roleId);

    if (role.isSystem) {
      throw new ForbiddenException('Cannot modify system roles');
    }

    // Validate permissions if provided
    if (data.permissions) {
      for (const perm of data.permissions) {
        if (!PERMISSIONS[perm]) {
          throw new BadRequestException(`Invalid permission: ${perm}`);
        }
      }
    }

    const updatedRole: Role = {
      ...role,
      ...data,
      updatedAt: new Date(),
    };

    // Save role
    const customRolesJson = await this.cache.get(`roles:${workspaceId}`);
    const customRoles: Role[] = customRolesJson
      ? JSON.parse(customRolesJson)
      : [];
    const index = customRoles.findIndex((r) => r.id === roleId);

    if (index !== -1) {
      customRoles[index] = updatedRole;
      await this.cache.set(
        `roles:${workspaceId}`,
        JSON.stringify(customRoles),
        86400 * 365,
      );
    }

    // Log audit
    await this.logPermissionChange(workspaceId, {
      action: 'role_updated',
      roleId,
      changes: data,
    });

    return updatedRole;
  }

  /**
   * Delete a custom role
   */
  async deleteRole(workspaceId: string, roleId: string): Promise<void> {
    const role = await this.getRole(workspaceId, roleId);

    if (role.isSystem) {
      throw new ForbiddenException('Cannot delete system roles');
    }

    const customRolesJson = await this.cache.get(`roles:${workspaceId}`);
    const customRoles: Role[] = customRolesJson
      ? JSON.parse(customRolesJson)
      : [];
    const filtered = customRoles.filter((r) => r.id !== roleId);

    await this.cache.set(
      `roles:${workspaceId}`,
      JSON.stringify(filtered),
      86400 * 365,
    );

    // Log audit
    await this.logPermissionChange(workspaceId, {
      action: 'role_deleted',
      roleId,
      roleName: role.name,
    });
  }

  // ==================== Resource Permissions ====================

  /**
   * Grant resource-level permissions
   */
  async grantResourcePermission(
    workspaceId: string,
    grantedBy: string,
    data: {
      userId: string;
      resourceType: 'portal' | 'widget' | 'workspace';
      resourceId: string;
      permissions: Permission[];
      expiresAt?: Date;
    },
  ): Promise<ResourcePermission> {
    const permissionId = `perm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const resourcePermission: ResourcePermission = {
      id: permissionId,
      userId: data.userId,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      permissions: data.permissions,
      grantedBy,
      grantedAt: new Date(),
      expiresAt: data.expiresAt,
    };

    // Save permission
    const key = `resource_perms:${workspaceId}:${data.userId}`;
    const permsJson = await this.cache.get(key);
    const perms: ResourcePermission[] = permsJson ? JSON.parse(permsJson) : [];
    perms.push(resourcePermission);

    await this.cache.set(key, JSON.stringify(perms), 86400 * 365);

    // Log audit
    await this.logPermissionChange(workspaceId, {
      action: 'permission_granted',
      userId: data.userId,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      permissions: data.permissions,
      grantedBy,
    });

    return resourcePermission;
  }

  /**
   * Revoke resource-level permissions
   */
  async revokeResourcePermission(
    workspaceId: string,
    userId: string,
    permissionId: string,
    revokedBy: string,
  ): Promise<void> {
    const key = `resource_perms:${workspaceId}:${userId}`;
    const permsJson = await this.cache.get(key);
    const perms: ResourcePermission[] = permsJson ? JSON.parse(permsJson) : [];

    const perm = perms.find((p) => p.id === permissionId);
    if (!perm) {
      throw new NotFoundException('Permission not found');
    }

    const filtered = perms.filter((p) => p.id !== permissionId);
    await this.cache.set(key, JSON.stringify(filtered), 86400 * 365);

    // Log audit
    await this.logPermissionChange(workspaceId, {
      action: 'permission_revoked',
      userId,
      permissionId,
      resourceType: perm.resourceType,
      resourceId: perm.resourceId,
      revokedBy,
    });
  }

  /**
   * Get user's resource permissions
   */
  async getUserResourcePermissions(
    workspaceId: string,
    userId: string,
  ): Promise<ResourcePermission[]> {
    const key = `resource_perms:${workspaceId}:${userId}`;
    const permsJson = await this.cache.get(key);
    const perms: ResourcePermission[] = permsJson ? JSON.parse(permsJson) : [];

    // Filter out expired permissions
    const now = new Date();
    return perms.filter((p) => !p.expiresAt || new Date(p.expiresAt) > now);
  }

  /**
   * Check if user has permission on resource
   */
  async checkPermission(
    workspaceId: string,
    userId: string,
    permission: Permission,
    resourceType?: 'portal' | 'widget' | 'workspace',
    resourceId?: string,
  ): Promise<boolean> {
    // Get user's role permissions
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) return false;

    // Map WorkspaceRole to role ID
    const roleMap: Record<string, string> = {
      OWNER: 'role_owner',
      ADMIN: 'role_admin',
      MEMBER: 'role_editor',
    };

    const roleId = roleMap[user.role] || 'role_viewer';
    const role = await this.getRole(workspaceId, roleId);

    // Check role permissions
    if (role.permissions.includes(permission)) {
      return true;
    }

    // Check resource-level permissions if resource specified
    if (resourceType && resourceId) {
      const resourcePerms = await this.getUserResourcePermissions(
        workspaceId,
        userId,
      );
      const matchingPerm = resourcePerms.find(
        (p) => p.resourceType === resourceType && p.resourceId === resourceId,
      );

      if (matchingPerm?.permissions.includes(permission)) {
        return true;
      }
    }

    return false;
  }

  // ==================== Approval Workflows ====================

  /**
   * Create an approval workflow
   */
  async createApprovalWorkflow(
    workspaceId: string,
    data: Omit<ApprovalWorkflow, 'id' | 'workspaceId'>,
  ): Promise<ApprovalWorkflow> {
    const workflowId = `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const workflow: ApprovalWorkflow = {
      id: workflowId,
      workspaceId,
      ...data,
    };

    const key = `workflows:${workspaceId}`;
    const workflowsJson = await this.cache.get(key);
    const workflows: ApprovalWorkflow[] = workflowsJson
      ? JSON.parse(workflowsJson)
      : [];
    workflows.push(workflow);

    await this.cache.set(key, JSON.stringify(workflows), 86400 * 365);

    return workflow;
  }

  /**
   * Get approval workflows
   */
  async getApprovalWorkflows(workspaceId: string): Promise<ApprovalWorkflow[]> {
    const key = `workflows:${workspaceId}`;
    const workflowsJson = await this.cache.get(key);
    return workflowsJson ? JSON.parse(workflowsJson) : [];
  }

  /**
   * Create an approval request
   */
  async createApprovalRequest(
    workspaceId: string,
    requesterId: string,
    data: {
      workflowId: string;
      action: string;
      resourceType: string;
      resourceId: string;
      changes: any;
    },
  ): Promise<ApprovalRequest> {
    const workflows = await this.getApprovalWorkflows(workspaceId);
    const workflow = workflows.find((w) => w.id === data.workflowId);

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    const requestId = `request_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const request: ApprovalRequest = {
      id: requestId,
      workflowId: data.workflowId,
      requesterId,
      action: data.action,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      changes: data.changes,
      status: 'pending',
      approvals: [],
      createdAt: new Date(),
      expiresAt: workflow.autoApproveAfter
        ? new Date(Date.now() + workflow.autoApproveAfter * 3600000)
        : undefined,
    };

    const key = `approval_requests:${workspaceId}`;
    const requestsJson = await this.cache.get(key);
    const requests: ApprovalRequest[] = requestsJson
      ? JSON.parse(requestsJson)
      : [];
    requests.push(request);

    await this.cache.set(key, JSON.stringify(requests), 86400 * 30);

    return request;
  }

  /**
   * Process approval decision
   */
  async processApprovalDecision(
    workspaceId: string,
    requestId: string,
    userId: string,
    decision: 'approved' | 'rejected',
    comment?: string,
  ): Promise<ApprovalRequest> {
    const key = `approval_requests:${workspaceId}`;
    const requestsJson = await this.cache.get(key);
    const requests: ApprovalRequest[] = requestsJson
      ? JSON.parse(requestsJson)
      : [];

    const requestIndex = requests.findIndex((r) => r.id === requestId);
    if (requestIndex === -1) {
      throw new NotFoundException('Approval request not found');
    }

    const request = requests[requestIndex];

    if (request.status !== 'pending') {
      throw new BadRequestException('Request is no longer pending');
    }

    // Add approval
    request.approvals.push({
      userId,
      decision,
      comment,
      timestamp: new Date(),
    });

    // Get workflow to check required approvers
    const workflows = await this.getApprovalWorkflows(workspaceId);
    const workflow = workflows.find((w) => w.id === request.workflowId);

    if (workflow) {
      const approvedCount = request.approvals.filter(
        (a) => a.decision === 'approved',
      ).length;
      const rejectedCount = request.approvals.filter(
        (a) => a.decision === 'rejected',
      ).length;

      if (rejectedCount > 0) {
        request.status = 'rejected';
      } else if (approvedCount >= workflow.requiredApprovers) {
        request.status = 'approved';
      }
    }

    requests[requestIndex] = request;
    await this.cache.set(key, JSON.stringify(requests), 86400 * 30);

    // Log audit
    await this.logPermissionChange(workspaceId, {
      action: 'approval_decision',
      requestId,
      userId,
      decision,
      newStatus: request.status,
    });

    return request;
  }

  /**
   * Get pending approval requests
   */
  async getPendingApprovalRequests(
    workspaceId: string,
  ): Promise<ApprovalRequest[]> {
    const key = `approval_requests:${workspaceId}`;
    const requestsJson = await this.cache.get(key);
    const requests: ApprovalRequest[] = requestsJson
      ? JSON.parse(requestsJson)
      : [];

    return requests.filter((r) => r.status === 'pending');
  }

  // ==================== Audit Trail ====================

  /**
   * Log permission change for audit
   */
  private async logPermissionChange(
    workspaceId: string,
    data: Record<string, any>,
  ): Promise<void> {
    const key = `permission_audit:${workspaceId}`;
    const logsJson = await this.cache.get(key);
    const logs: any[] = logsJson ? JSON.parse(logsJson) : [];

    logs.push({
      ...data,
      timestamp: new Date(),
    });

    // Keep last 1000 entries
    const trimmed = logs.slice(-1000);
    await this.cache.set(key, JSON.stringify(trimmed), 86400 * 90);
  }

  /**
   * Get permission audit logs
   */
  async getPermissionAuditLogs(
    workspaceId: string,
    options?: { limit?: number; action?: string },
  ): Promise<any[]> {
    const key = `permission_audit:${workspaceId}`;
    const logsJson = await this.cache.get(key);
    let logs: any[] = logsJson ? JSON.parse(logsJson) : [];

    if (options?.action) {
      logs = logs.filter((l) => l.action === options.action);
    }

    const limit = options?.limit || 100;
    return logs.slice(-limit).reverse();
  }

  /**
   * Get all available permissions
   */
  getAvailablePermissions(): Array<{ key: Permission; description: string }> {
    return Object.entries(PERMISSIONS).map(([key, description]) => ({
      key: key as Permission,
      description,
    }));
  }
}
