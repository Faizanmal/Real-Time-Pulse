import { createRealtimeEvent, resetRealtimeRevisionForTests } from './realtime-event';

describe('createRealtimeEvent', () => {
  beforeEach(() => resetRealtimeRevisionForTests());

  it('adds a stable v1 transport contract while retaining legacy payload fields', () => {
    const event = createRealtimeEvent({ portalId: 'portal-demo', value: 12 }, {
      tenantId: 'workspace-demo', resourceType: 'portal', resourceId: 'portal-demo',
    });

    expect(event).toMatchObject({
      portalId: 'portal-demo', value: 12, version: 1, revision: 1,
      tenantId: 'workspace-demo', resourceType: 'portal', resourceId: 'portal-demo',
    });
    expect(event.eventId).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(event.serverTimestamp))).toBe(false);
  });

  it('preserves source event IDs across retries while advancing the delivery revision', () => {
    const scope = { tenantId: 'tenant-a', resourceType: 'widget' as const, resourceId: 'widget-1' };
    const first = createRealtimeEvent({ eventId: 'source-event-1', value: 1 }, scope);
    const retry = createRealtimeEvent({ eventId: 'source-event-1', value: 1 }, scope);

    expect(retry.eventId).toBe(first.eventId);
    expect(retry.revision).toBe(first.revision + 1);
  });
});
