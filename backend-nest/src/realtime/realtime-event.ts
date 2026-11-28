import { randomUUID } from 'node:crypto';

export type RealtimeResourceType = 'workspace' | 'portal' | 'widget' | 'user' | 'system';

export interface RealtimeEventEnvelope {
  eventId: string;
  version: 1;
  revision: number;
  tenantId: string | null;
  resourceType: RealtimeResourceType;
  resourceId: string;
  serverTimestamp: string;
}

let revision = 0;

/** Additive v1 metadata: existing event payload fields remain at the top level. */
export function createRealtimeEvent<T extends Record<string, unknown>>(
  data: T,
  scope: Omit<RealtimeEventEnvelope, 'eventId' | 'version' | 'revision' | 'serverTimestamp'>,
): T & RealtimeEventEnvelope {
  revision += 1;
  return {
    ...data,
    eventId: typeof data.eventId === 'string' ? data.eventId : randomUUID(),
    version: 1,
    revision,
    ...scope,
    serverTimestamp: new Date().toISOString(),
  };
}

export function resetRealtimeRevisionForTests(): void {
  revision = 0;
}
