export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  workspaceId: string;
  role: string;
}

export interface AuthResponse {
  accessToken: string;
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
