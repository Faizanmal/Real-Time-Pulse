export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  name?: string; // Computed or provided name
  avatar?: string; // Avatar URL
  workspaceId: string;
  role: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user: User;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  brandColor: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Portal {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shareToken: string;
  isPublic: boolean;
  layout: Record<string, unknown> | null;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string | null;
  widgetCount?: number;
}

export interface WorkspaceMember {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatar?: string | null;
  role: string;
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface Widget {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown> | null;
  gridWidth: number;
  gridHeight: number;
  gridX: number;
  gridY: number;
  refreshInterval: number;
  lastRefreshedAt: string | null;
  portalId: string;
  integrationId: string | null;
  createdAt: string;
  updatedAt: string;
  integration?: {
    id: string;
    provider: string;
    name: string;
  };
  cachedData?: unknown;
}

export interface Integration {
  id: string;
  workspaceId: string;
  provider: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
  settings: Record<string, unknown>;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

export interface AuditLog {
  id: string;
  userId: string;
  workspaceId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

export interface WorkspaceStats {
  totalPortals: number;
  totalWidgets: number;
  totalIntegrations: number;
  totalMembers: number;
  activePortals: number;
  recentActivity: number;
}

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  uptime: number;
  version: string;
  database: boolean;
  redis: boolean;
  timestamp: string;
}
