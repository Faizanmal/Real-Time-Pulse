import { UnauthorizedException } from '@nestjs/common';

import { AuthService } from './auth.service';

jest.mock('@nestjs/config', () => ({ ConfigService: class ConfigService {} }));
jest.mock('@nestjs/jwt', () => ({ JwtService: class JwtService {} }));
jest.mock('../audit/audit.service', () => ({ AuditService: class AuditService {} }));
jest.mock('../cache/cache.service', () => ({ CacheService: class CacheService {} }));
jest.mock('../common/services/encryption.service', () => ({
  EncryptionService: class EncryptionService {},
}));
jest.mock('../common/services/rate-limit.service', () => ({
  RateLimitService: class RateLimitService {},
}));
jest.mock('../common/services/recaptcha.service', () => ({
  RecaptchaService: class RecaptchaService {},
}));
jest.mock('../email/email.service', () => ({ EmailService: class EmailService {} }));
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class PrismaService {} }));
jest.mock('./services/firebase-auth.service', () => ({
  FirebaseAuthService: class FirebaseAuthService {},
}));

describe('AuthService refresh rotation', () => {
  it('rejects replayed or stale refresh tokens after their one-time cache key was consumed', async () => {
    const cacheService = { consume: jest.fn().mockResolvedValue(null) };
    const service = Object.create(AuthService.prototype) as AuthService;
    Object.defineProperties(service, {
      cacheService: { value: cacheService },
      REFRESH_TOKEN_PREFIX: { value: 'refresh_token:' },
    });

    await expect(
      service.refreshToken('already-used-refresh', { ip: '127.0.0.1', userAgent: 'test' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(cacheService.consume).toHaveBeenCalledWith('refresh_token:already-used-refresh');
  });

  it('revokes every tracked access and refresh token on logout-all', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 600;
    const cacheService = {
      getSetMembers: jest
        .fn()
        .mockResolvedValueOnce(['fictional-refresh-token'])
        .mockResolvedValueOnce(['fictional-access-token']),
      set: jest.fn().mockResolvedValue(undefined),
      deleteMany: jest.fn().mockResolvedValue(undefined),
    };
    const service = Object.create(AuthService.prototype) as AuthService;
    Object.defineProperties(service, {
      cacheService: { value: cacheService },
      jwtService: { value: { decode: jest.fn().mockReturnValue({ exp: expiresAt }) } },
      logger: { value: { log: jest.fn() } },
      REFRESH_TOKEN_PREFIX: { value: 'refresh_token:' },
      USER_REFRESH_TOKENS_PREFIX: { value: 'user_refresh_tokens:' },
      USER_ACCESS_TOKENS_PREFIX: { value: 'user_access_tokens:' },
      BLACKLIST_PREFIX: { value: 'token_blacklist:' },
    });

    await service.logoutAllSessions('fictional-user');

    expect(cacheService.set).toHaveBeenCalledWith(
      'token_blacklist:fictional-access-token',
      'blacklisted',
      expect.any(Number),
    );
    expect(cacheService.deleteMany).toHaveBeenCalledWith([
      'refresh_token:fictional-refresh-token',
      'user_refresh_tokens:fictional-user',
      'user_access_tokens:fictional-user',
    ]);
  });
});
