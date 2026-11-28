import { EventEmitter2 } from '@nestjs/event-emitter';

import {
  DOMAIN_EVENT_ENVELOPE_VERSION,
  EventSourcingService,
  toVersionedEventEnvelope,
} from './event-sourcing.service';

describe('Domain event envelope compatibility', () => {
  it('adds an envelope version while preserving legacy event fields and aggregate version', () => {
    const emitter = { emit: jest.fn() } as unknown as EventEmitter2;
    const service = new EventSourcingService({}, emitter);

    const event = service.createEvent('portal-1', 'Portal', 'PortalCreated', { name: 'Northstar' }, { workspaceId: 'workspace-1' }, 7);

    expect(event).toMatchObject({
      envelopeVersion: DOMAIN_EVENT_ENVELOPE_VERSION,
      aggregateId: 'portal-1',
      aggregateType: 'Portal',
      eventType: 'PortalCreated',
      version: 7,
      payload: { name: 'Northstar' },
      metadata: { workspaceId: 'workspace-1' },
    });
    expect(event.timestamp).toBeInstanceOf(Date);
    expect(event.eventId).toEqual(expect.any(String));
  });

  it('keeps legacy typed/catch-all channels and adds the v1 envelope channel', async () => {
    const emitter = { emit: jest.fn() } as unknown as EventEmitter2;
    const service = new EventSourcingService({}, emitter);
    const event = service.createEvent('portal-1', 'Portal', 'PortalCreated', { name: 'Northstar' });

    await service.dispatch(event);

    expect(emitter.emit).toHaveBeenNthCalledWith(1, 'PortalCreated', event);
    expect(emitter.emit).toHaveBeenNthCalledWith(2, 'domain.event', event);
    expect(emitter.emit).toHaveBeenNthCalledWith(3, 'domain.event.v1', toVersionedEventEnvelope(event));
  });

  it('projects the versioned envelope without changing the legacy event object', () => {
    const emitter = { emit: jest.fn() } as unknown as EventEmitter2;
    const service = new EventSourcingService({}, emitter);
    const event = service.createEvent('portal-1', 'Portal', 'PortalCreated', { name: 'Northstar' });

    const envelope = toVersionedEventEnvelope(event);

    expect(envelope).toEqual({
      envelopeVersion: 1,
      eventId: event.eventId,
      eventType: 'PortalCreated',
      occurredAt: event.timestamp.toISOString(),
      aggregate: { id: 'portal-1', type: 'Portal', version: 1 },
      data: { name: 'Northstar' },
      metadata: {},
    });
    expect(event).toHaveProperty('aggregateId', 'portal-1');
    expect(event).toHaveProperty('payload.name', 'Northstar');
  });
});
