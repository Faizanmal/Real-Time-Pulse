import type { Prisma } from '@prisma/client';

export interface PublishedWidgetSnapshot {
  id: string;
  name: string;
  type: string;
  integrationId: string | null;
  provider: string | null;
  order: number;
  layout: { x: number; y: number; w: number; h: number };
}

export interface PublishedPortalSnapshot {
  version: 1;
  revision: number;
  publishedAt: string;
  name: string;
  description: string | null;
  workspaceName: string;
  primaryColor: string;
  widgets: PublishedWidgetSnapshot[];
  metrics?: Array<Record<string, unknown>>;
  valueClaims?: Array<Record<string, unknown>>;
  clientStatus?: string | null;
  clientStatusNote?: string | null;
  latestDeliverable?: string | null;
  pendingDecision?: string | null;
  clientUpdateAt?: string | null;
}

type SnapshotSource = {
  name: string;
  description: string | null;
  clientStatus?: string | null;
  clientStatusNote?: string | null;
  latestDeliverable?: string | null;
  pendingDecision?: string | null;
  clientUpdateAt?: Date | null;
  layout?: unknown;
  workspace: { name: string; primaryColor: string | null };
  widgets: Array<{
    id: string;
    name: string;
    type: string;
    order: number;
    integrationId: string | null;
    integration: { provider: string } | null;
    gridX: number;
    gridY: number;
    gridWidth: number;
    gridHeight: number;
  }>;
};

function orderedWidgets(source: SnapshotSource) {
  const storedOrder =
    source.layout && typeof source.layout === 'object' && !Array.isArray(source.layout)
      ? (source.layout as { widgetOrder?: unknown }).widgetOrder
      : undefined;
  if (!Array.isArray(storedOrder) || !storedOrder.every((id) => typeof id === 'string'))
    return source.widgets;
  const rank = new Map(storedOrder.map((id, index) => [id, index]));
  return [...source.widgets].sort(
    (a, b) =>
      (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER) ||
      a.order - b.order,
  );
}

/** Store only fields needed to reconstruct the client view. Never copy widget config or credentials. */
export function createPublishedPortalSnapshot(
  source: SnapshotSource,
  revision: number,
  publishedAt = new Date(),
  metrics: Array<Record<string, unknown>> = [],
  valueClaims: Array<Record<string, unknown>> = [],
): Prisma.InputJsonObject {
  const snapshot: PublishedPortalSnapshot = {
    version: 1,
    revision,
    publishedAt: publishedAt.toISOString(),
    name: source.name,
    description: source.description,
    workspaceName: source.workspace.name,
    primaryColor: source.workspace.primaryColor ?? '#2563eb',
    widgets: orderedWidgets(source).map((widget, index) => ({
      id: widget.id,
      name: widget.name,
      type: widget.type,
      integrationId: widget.integrationId,
      provider: widget.integration?.provider ?? null,
      order: index,
      layout: {
        x: widget.gridX,
        y: widget.gridY,
        w: widget.gridWidth,
        h: widget.gridHeight,
      },
    })),
    metrics,
    valueClaims,
    clientStatus: source.clientStatus ?? null,
    clientStatusNote: source.clientStatusNote ?? null,
    latestDeliverable: source.latestDeliverable ?? null,
    pendingDecision: source.pendingDecision ?? null,
    clientUpdateAt: source.clientUpdateAt?.toISOString() ?? null,
  };
  return snapshot as unknown as Prisma.InputJsonObject;
}

export function readPublishedPortalSnapshot(value: unknown): PublishedPortalSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const snapshot = value as Partial<PublishedPortalSnapshot>;
  if (
    snapshot.version !== 1 ||
    !Array.isArray(snapshot.widgets) ||
    typeof snapshot.name !== 'string'
  )
    return null;
  return snapshot as PublishedPortalSnapshot;
}
