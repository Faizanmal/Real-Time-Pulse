import { EventStore } from './event-store';

describe('EventStore envelope compatibility', () => {
  it('reads pre-migration events as envelope version 1', () => {
    const store = Object.create(EventStore.prototype) as EventStore;
    const timestamp = new Date('2026-01-01T00:00:00.000Z');
    const event = (store as any).mapToEvent({
      eventId: 'legacy-event-1',
      aggregateId: 'portal-1',
      aggregateType: 'Portal',
      eventType: 'PortalCreated',
      version: 1,
      timestamp,
      payload: JSON.stringify({ name: 'Northstar' }),
      metadata: JSON.stringify({ workspaceId: 'workspace-1' }),
    });

    expect(event).toMatchObject({
      envelopeVersion: 1,
      eventId: 'legacy-event-1',
      eventType: 'PortalCreated',
      version: 1,
      payload: { name: 'Northstar' },
    });
  });

  it('fails clearly when a future envelope version is not supported', () => {
    const store = Object.create(EventStore.prototype) as EventStore;
    expect(() => (store as any).mapToEvent({ envelopeVersion: 2 })).toThrow(
      'Unsupported domain event envelope version: 2',
    );
  });
});
