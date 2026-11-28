import { ForbiddenException } from '@nestjs/common';
import type { Request, Response } from 'express';

import { AuthController } from './auth.controller';

jest.mock('@nestjs/config', () => ({ ConfigService: class ConfigService {} }));
jest.mock('@nestjs/jwt', () => ({ JwtService: class JwtService {} }));
jest.mock('./auth.service', () => ({ AuthService: class AuthService {} }));
jest.mock('./services/firebase-auth.service', () => ({
  FirebaseAuthService: class FirebaseAuthService {},
}));
jest.mock('./guards/google-auth.guard', () => ({ GoogleAuthGuard: class GoogleAuthGuard {} }));
jest.mock('./guards/github-auth.guard', () => ({ GitHubAuthGuard: class GitHubAuthGuard {} }));
jest.mock('./guards/jwt-auth.guard', () => ({ JwtAuthGuard: class JwtAuthGuard {} }));

describe('AuthController browser session compatibility contract', () => {
  const tokenResponse = {
    accessToken: 'fictional-access-token',
    refreshToken: 'fictional-refresh-token',
    expiresIn: 900,
    user: { id: 'demo-user', workspaceId: 'demo-workspace' },
  };
  let service: { signIn: jest.Mock };
  let controller: AuthController;
  let response: Pick<Response, 'cookie' | 'setHeader'>;
  let originalFlag: string | undefined;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalFlag = process.env.AUTH_LEGACY_TOKEN_RESPONSES;
    originalNodeEnv = process.env.NODE_ENV;
    delete process.env.AUTH_LEGACY_TOKEN_RESPONSES;
    service = { signIn: jest.fn().mockResolvedValue(tokenResponse) };
    controller = new AuthController(service as never, {} as never);
    response = { cookie: jest.fn(), setHeader: jest.fn() };
  });

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.AUTH_LEGACY_TOKEN_RESPONSES;
    else process.env.AUTH_LEGACY_TOKEN_RESPONSES = originalFlag;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  const trustedRequest = (origin = 'http://localhost:3001', csrf = 'browser-session') =>
    ({
      headers: { origin, 'x-csrf-token': csrf },
    }) as unknown as Request;

  it('uses HttpOnly cookies and omits token fields from legacy route by default', async () => {
    const result = await controller.signIn(
      { email: 'agency@example.invalid', password: 'local-demo-only' },
      trustedRequest(),
      response as Response,
      '127.0.0.1',
      'test',
    );

    expect(result).toEqual({ user: tokenResponse.user, expiresIn: 900 });
    expect(result).not.toHaveProperty('accessToken');
    expect(result).not.toHaveProperty('refreshToken');
    expect(response.cookie).toHaveBeenCalledWith(
      'pulse_access',
      tokenResponse.accessToken,
      expect.objectContaining({ httpOnly: true }),
    );
    expect(response.cookie).toHaveBeenCalledWith(
      'pulse_refresh',
      tokenResponse.refreshToken,
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('rejects a forged origin before creating a session', async () => {
    await expect(
      controller.signIn(
        { email: 'agency@example.invalid', password: 'local-demo-only' },
        trustedRequest('https://attacker.invalid'),
        response as Response,
        '127.0.0.1',
        'test',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.signIn).not.toHaveBeenCalled();
  });

  it('retains the former JSON contract only when the explicit migration flag is enabled', async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_LEGACY_TOKEN_RESPONSES = 'true';
    const result = await controller.signIn(
      { email: 'agency@example.invalid', password: 'local-demo-only' },
      {} as Request,
      response as Response,
      '127.0.0.1',
      'test',
    );
    expect(result).toEqual(tokenResponse);
    expect(response.cookie).not.toHaveBeenCalled();
  });

  it('never returns token bodies if the legacy flag is mis-set in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_LEGACY_TOKEN_RESPONSES = 'true';
    await expect(controller.signIn(
      { email: 'agency@example.invalid', password: 'local-demo-only' },
      {} as Request,
      response as Response,
      '127.0.0.1',
      'test',
    )).rejects.toThrow('Legacy token responses are disabled in production');
    expect(service.signIn).not.toHaveBeenCalled();
    expect(response.cookie).not.toHaveBeenCalled();
  });
});
