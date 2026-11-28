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
  user: User;
  expiresIn: number;
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
  draftMode?: boolean;
  publishedAt?: string | null;
  publishRevision?: number;
  layout: Record<string, unknown> | null;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string | null;
  widgetCount?: number;
  clientStatus?:
    "ON_TRACK" | "NEEDS_ATTENTION" | "BLOCKED" | "COMPLETED" | null;
  clientStatusNote?: string | null;
  latestDeliverable?: string | null;
  pendingDecision?: string | null;
  clientUpdateAt?: string | null;
}

export interface DemoMetric {
  key: string;
  label: string;
  value: number;
  unit: string;
}

export interface PublicPortalWidget {
  id: string;
  name: string;
  type: string;
  data: {
    isDemo: boolean;
    sourceLabel: string;
    datasetName: string;
    asOfDate: string;
    metrics: DemoMetric[];
  } | null;
  sourceLabel: string;
  isDemo: boolean;
  layout?: { x: number; y: number; w: number; h: number };
}

export interface PublicPortalView {
  id: string;
  name: string;
  description: string | null;
  workspaceName: string;
  primaryColor: string;
  widgets: PublicPortalWidget[];
  metrics?: Array<{
    id: string;
    name: string;
    value: string | null;
    unit: string;
    source: string;
    timeRange: { start: string; end: string; timeZone: string } | null;
    lastUpdatedAt: string | null;
    sourceFreshnessAt: string | null;
    health: string;
    quality: string;
    confidence: string | null;
    calculation: string;
    limitations: unknown;
    sources?: Array<{ externalId: string; updatedAt: string | null }>;
  }>;
  valueClaims?: PublicValueClaim[];
  viewMode?: "published" | "draft-preview" | "legacy-live";
  publishedAt?: string | null;
  publishRevision?: number;
  clientStatus?: string | null;
  clientStatusNote?: string | null;
  latestDeliverable?: string | null;
  pendingDecision?: string | null;
  clientUpdateAt?: string | null;
  feedStatus?: {
    health: "CURRENT" | "STALE" | "ATTENTION" | "NO_DATA";
    lastSyncedAt: string | null;
    lastValidDataAt: string | null;
    sourceCount: number;
  };
}

export interface PublicValueClaim {
  revision: number;
  title: string;
  formula: string;
  calculation: string;
  value: string;
  unit: string;
  period: { start: string; end: string; timeZone: string };
  assumptions: Record<
    string,
    {
      low: number;
      base: number;
      high: number;
      unit: string;
      evidence: {
        kind: "SOURCE_REFERENCE" | "HUMAN_NOTE";
        label: string;
        reference?: string;
        note?: string;
        owner: string;
        enteredAt: string;
      };
    }
  >;
  sensitivity: { low: number; base: number; high: number; unit: string };
  enteredBy: string;
  enteredAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  limitation: string;
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
  provider: string;
  name: string;
  status: "active" | "inactive" | "error";
  connectionState?:
    "CONNECTED" | "DEGRADED" | "NEEDS_RECONNECT" | "DISCONNECTED";
  statusMessage?: string;
  lastValidDataAt?: string | null;
  settings: Record<string, unknown>;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  type: "info" | "success" | "warning" | "error";
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
  status: "ok" | "degraded" | "down";
  uptime: number;
  version: string;
  database: boolean;
  redis: boolean;
  timestamp: string;
}
