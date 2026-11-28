import type { Server } from 'node:http';

import { NotFoundException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
  CronExpression: { EVERY_MINUTE: '* * * * *' },
}));

describe('Alert API tenant contract', () => {
  let app: INestApplication;
  let server: Server;
  const create = jest.fn();
  const findAll = jest.fn();
  const findOne = jest.fn();
  const update = jest.fn();
  const remove = jest.fn();
  const getHistory = jest.fn();
  const retryDelivery = jest.fn();
  const testAlert = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AlertsController],
      providers: [{ provide: AlertsService, useValue: { create, findAll, findOne, update, remove, getHistory, retryDelivery, testAlert } }],
    }).overrideGuard(JwtAuthGuard).useValue({
      canActivate: (context: any) => {
        const requestValue = context.switchToHttp().getRequest();
        if (requestValue.headers['x-test-role'] === 'MEMBER') return false;
        requestValue.user = {
          id: 'fictional-owner',
          email: 'owner@fictional.invalid',
          workspaceId: requestValue.headers['x-test-workspace'] ?? 'workspace-a',
          role: requestValue.headers['x-test-role'] ?? 'OWNER',
        };
        return true;
      },
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    findOne.mockRejectedValue(new NotFoundException('Alert not found'));
    retryDelivery.mockRejectedValue(new NotFoundException('Alert delivery not found'));
    create.mockImplementation((workspaceId, userId, dto) => ({ id: 'alert-fixture-a', workspaceId, userId, ...dto }));
  });

  it('scopes guessed alert IDs to the authenticated workspace', async () => {
    await request(server).get('/api/v1/alerts/guessable-alert-b').expect(404);
    expect(findOne).toHaveBeenCalledWith('guessable-alert-b', 'workspace-a');
  });

  it('does not let client members access alert management', async () => {
    await request(server).get('/api/v1/alerts').set('x-test-role', 'MEMBER').expect(403);
    expect(findAll).not.toHaveBeenCalled();
  });

  it('ignores a forged workspace in alert creation', async () => {
    const result = await request(server).post('/api/v1/alerts').send({
      workspaceId: 'workspace-b',
      name: 'Fictional provider sync alert',
      condition: { metric: 'provider.sync_failures', operator: '>=', threshold: 1 },
      channels: [],
    }).expect(201);
    expect(create).toHaveBeenCalledWith('workspace-a', 'fictional-owner', expect.objectContaining({
      name: 'Fictional provider sync alert', workspaceId: 'workspace-b',
    }));
  });

  it('passes the authenticated workspace to delivery retry even for guessed IDs', async () => {
    await request(server).post('/api/v1/alerts/alert-a/deliveries/guessable-delivery-b/retry')
      .set('x-test-workspace', 'workspace-a')
      .expect(404);
    expect(retryDelivery).toHaveBeenCalledWith('alert-a', 'guessable-delivery-b', 'workspace-a');
  });
});
