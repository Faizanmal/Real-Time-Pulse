import type { Server } from 'node:http';

import { ForbiddenException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AgencyRoleGuard } from '../auth/guards/agency-role.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
  CronExpression: { EVERY_HOUR: '0 0 * * * *' },
}));
jest.mock('../share-links/share-links.service', () => ({
  ShareLinksService: class ShareLinksService {},
}));

import { ClientDecisionController, DecisionInboxController } from './decision-inbox.controller';
import { DecisionInboxService } from './decision-inbox.service';

describe('Decision inbox API contracts', () => {
  let app: INestApplication;
  let server: Server;
  const listAgency = jest.fn();
  const create = jest.fn();
  const listClient = jest.fn();
  const respond = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [DecisionInboxController, ClientDecisionController],
      providers: [{
        provide: DecisionInboxService,
        useValue: { listAgency, create, listClient, respond, getPolicy: jest.fn(), updatePolicy: jest.fn(), withdraw: jest.fn() },
      }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: (context: any) => {
        const request = context.switchToHttp().getRequest();
        request.user = { id: 'owner-a', email: 'owner@example.test', workspaceId: request.headers['x-test-workspace'] || 'agency-a', role: request.headers['x-test-role'] || 'OWNER' };
        return true;
      } })
      .overrideGuard(OptionalJwtAuthGuard)
      .useValue({ canActivate: (context: any) => {
        const request = context.switchToHttp().getRequest();
        request.user = request.headers['x-test-client'] === 'client-a'
          ? { id: 'client-a', email: 'client@example.test', workspaceId: 'agency-a', role: 'MEMBER' }
          : request.headers['x-test-client'] === 'client-b'
            ? { id: 'client-b', email: 'other@example.test', workspaceId: 'agency-b', role: 'MEMBER' }
            : undefined;
        return true;
      } })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('denies client roles on the agency inbox and never calls the listing service', async () => {
    await request(server).get('/api/v1/decision-inbox').set('x-test-role', 'MEMBER').expect(403);
    expect(listAgency).not.toHaveBeenCalled();
  });

  it('scopes agency list and create to the authenticated workspace', async () => {
    listAgency.mockResolvedValue([{
      id: 'decision-a',
      clientEmail: 'client@example.test',
      timeline: [{
        eventId: 'event-a',
        version: 1,
        revision: 3,
        workspaceId: 'agency-a',
        resourceType: 'CLIENT_DECISION',
        resourceId: 'decision-a',
        eventType: 'REQUESTED',
        serverTimestamp: '2026-11-27T09:00:00.000Z',
      }],
    }]);
    create.mockResolvedValue({ id: 'decision-a', status: 'OPEN', portalRevision: 3 });
    await request(server).get('/api/v1/decision-inbox').set('x-test-workspace', 'agency-a')
      .expect(200).expect(({ body }) => expect(body.data ?? body).toEqual([expect.objectContaining({
        id: 'decision-a',
        clientEmail: 'client@example.test',
        timeline: [expect.objectContaining({ eventId: 'event-a', version: 1, revision: 3, workspaceId: 'agency-a', resourceId: 'decision-a', serverTimestamp: '2026-11-27T09:00:00.000Z' })],
      })]));
    expect(listAgency).toHaveBeenCalledWith('agency-a', 'owner-a', undefined);
    await request(server).post('/api/v1/decision-inbox').set('x-test-workspace', 'agency-a').send({
      sourceShareLinkId: '11111111-1111-4111-8111-111111111111',
      clientUserId: '00000000-0000-4000-8000-000000000012',
      title: 'Fictional approval',
      prompt: 'Approve revision three?',
    }).expect(201);
    expect(create).toHaveBeenCalledWith('agency-a', 'owner-a', expect.objectContaining({ title: 'Fictional approval' }));
  });

  it('does not let another client account retrieve or answer a request', async () => {
    listClient.mockRejectedValue(new ForbiddenException('assigned client only'));
    respond.mockRejectedValue(new ForbiddenException('assigned client only'));
    await request(server).post('/api/v1/share-links/public/opaque-link/decisions/list')
      .set('x-test-client', 'client-b').send({}).expect(403);
    await request(server).post('/api/v1/share-links/public/opaque-link/decisions/decision-a/respond')
      .set('x-test-client', 'client-b')
      .send({ expectedRevision: 3, response: 'APPROVE' }).expect(403);
    expect(listClient).toHaveBeenCalledWith('opaque-link', undefined, 'client-b');
    expect(respond).toHaveBeenCalledWith('opaque-link', 'decision-a', 'client-b', expect.objectContaining({ expectedRevision: 3 }));
  });

  it('returns an immutable response contract for an assigned client', async () => {
    listClient.mockResolvedValue({ currentPortalRevision: 3, decisions: [{ id: 'decision-a', status: 'OPEN', portalRevision: 3, canRespond: true }] });
    respond.mockResolvedValue({ id: 'decision-a', status: 'APPROVED', portalRevision: 3, idempotent: false, response: { response: 'APPROVE', comment: 'Fictional response', portalRevision: 3 } });
    await request(server).post('/api/v1/share-links/public/opaque-link/decisions/list')
      .set('x-test-client', 'client-a').send({}).expect(201);
    const submission = { expectedRevision: 3, response: 'APPROVE', comment: 'Fictional response' };
    await request(server).post('/api/v1/share-links/public/opaque-link/decisions/decision-a/respond')
      .set('x-test-client', 'client-a').send(submission).expect(201)
      .expect(({ body }) => expect(body.data ?? body).toMatchObject({ response: { portalRevision: 3, comment: 'Fictional response' } }));
    expect(respond).toHaveBeenCalledWith('opaque-link', 'decision-a', 'client-a', expect.objectContaining(submission));
  });
});
