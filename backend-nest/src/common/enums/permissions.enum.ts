export enum Permission {
  // Workspace permissions
  WORKSPACE_CREATE = 'workspace:create',
  WORKSPACE_READ = 'workspace:read',
  WORKSPACE_UPDATE = 'workspace:update',
  WORKSPACE_DELETE = 'workspace:delete',
  WORKSPACE_INVITE = 'workspace:invite',
  WORKSPACE_MANAGE_MEMBERS = 'workspace:manage_members',

  // Portal permissions
  PORTAL_CREATE = 'portal:create',
  PORTAL_READ = 'portal:read',
  PORTAL_UPDATE = 'portal:update',
  PORTAL_DELETE = 'portal:delete',
  PORTAL_PUBLISH = 'portal:publish',

  // Widget permissions
  WIDGET_CREATE = 'widget:create',
  WIDGET_READ = 'widget:read',
  WIDGET_UPDATE = 'widget:update',
  WIDGET_DELETE = 'widget:delete',
  WIDGET_CONFIGURE = 'widget:configure',

  // Integration permissions
  INTEGRATION_CREATE = 'integration:create',
  INTEGRATION_READ = 'integration:read',
  INTEGRATION_UPDATE = 'integration:update',
  INTEGRATION_DELETE = 'integration:delete',
  INTEGRATION_SYNC = 'integration:sync',

  // Audit permissions
  AUDIT_READ = 'audit:read',
  AUDIT_EXPORT = 'audit:export',

  // Analytics permissions
  ANALYTICS_READ = 'analytics:read',
  ANALYTICS_EXPORT = 'analytics:export',

  // Admin permissions
  ADMIN_FULL_ACCESS = 'admin:full_access',
}

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  OWNER: [
    // All permissions
    ...Object.values(Permission),
  ],
  ADMIN: [
    Permission.WORKSPACE_READ,
    Permission.WORKSPACE_UPDATE,
    Permission.WORKSPACE_INVITE,
    Permission.WORKSPACE_MANAGE_MEMBERS,
    Permission.PORTAL_CREATE,
    Permission.PORTAL_READ,
    Permission.PORTAL_UPDATE,
    Permission.PORTAL_DELETE,
    Permission.PORTAL_PUBLISH,
    Permission.WIDGET_CREATE,
    Permission.WIDGET_READ,
    Permission.WIDGET_UPDATE,
    Permission.WIDGET_DELETE,
    Permission.WIDGET_CONFIGURE,
    Permission.INTEGRATION_CREATE,
    Permission.INTEGRATION_READ,
    Permission.INTEGRATION_UPDATE,
    Permission.INTEGRATION_DELETE,
    Permission.INTEGRATION_SYNC,
    Permission.AUDIT_READ,
    Permission.AUDIT_EXPORT,
    Permission.ANALYTICS_READ,
    Permission.ANALYTICS_EXPORT,
  ],
  EDITOR: [
    Permission.WORKSPACE_READ,
    Permission.PORTAL_READ,
    Permission.PORTAL_UPDATE,
    Permission.WIDGET_CREATE,
    Permission.WIDGET_READ,
    Permission.WIDGET_UPDATE,
    Permission.WIDGET_DELETE,
    Permission.WIDGET_CONFIGURE,
    Permission.INTEGRATION_READ,
    Permission.ANALYTICS_READ,
  ],
  VIEWER: [
    Permission.WORKSPACE_READ,
    Permission.PORTAL_READ,
    Permission.WIDGET_READ,
    Permission.INTEGRATION_READ,
    Permission.ANALYTICS_READ,
  ],
};
