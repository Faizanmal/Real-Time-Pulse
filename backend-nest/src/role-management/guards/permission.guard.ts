import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleManagementService, Permission } from '../role-management.service';

export const PERMISSIONS_KEY = 'permissions';
export const RESOURCE_KEY = 'resource';

export interface ResourceInfo {
  type: 'portal' | 'widget' | 'workspace';
  idParam: string;
}

/**
 * Decorator to require permissions
 */
export function RequirePermissions(...permissions: Permission[]) {
  return (target: object, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(PERMISSIONS_KEY, permissions, descriptor.value);
    return descriptor;
  };
}

/**
 * Decorator to specify resource for permission check
 */
export function ForResource(type: ResourceInfo['type'], idParam = 'id') {
  return (target: object, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(RESOURCE_KEY, { type, idParam }, descriptor.value);
    return descriptor;
  };
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly roleService: RoleManagementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<Permission[]>(
      PERMISSIONS_KEY,
      context.getHandler(),
    );

    // No permissions required
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Get resource info if specified
    const resourceInfo = this.reflector.get<ResourceInfo>(RESOURCE_KEY, context.getHandler());

    let resourceId: string | undefined;
    if (resourceInfo) {
      resourceId = request.params[resourceInfo.idParam];
    }

    // Check each required permission
    for (const permission of requiredPermissions) {
      const hasPermission = await this.roleService.checkPermission(
        user.workspaceId,
        user.sub,
        permission,
        resourceInfo?.type,
        resourceId,
      );

      if (!hasPermission) {
        throw new ForbiddenException(`Missing required permission: ${permission}`);
      }
    }

    return true;
  }
}
