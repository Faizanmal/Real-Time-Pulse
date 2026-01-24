/**
 * Auth Service Unit Tests
 * Tests for authentication and authorization functionality
 */

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { AuditService } from '../audit/audit.service';
import * as bcrypt from 'bcryptjs';
import {
  createMockPrismaService,
  createMockJwtService,
  createMockConfigService,
  createMockRedisService,
  createTestUser,
} from 'common/testing/test-utils';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: any;
  let jwtService: any;
  let cacheService: any;
  let auditService: any;

  beforeEach(async () => {
    prismaService = createMockPrismaService();
    jwtService = createMockJwtService();
    cacheService = createMockRedisService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: createMockConfigService() },
        { provide: CacheService, useValue: cacheService },
        {
          provide: AuditService,
          useValue: {
            logAction: jest.fn(),
            logAuthEvent: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    auditService = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user without password if validation succeeds', async () => {
      const testUser = createTestUser();
      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      testUser.password = hashedPassword;

      prismaService.user.findUnique.mockResolvedValue(testUser);

      const result = await service.validateUser('test@example.com', 'correctpassword');

      expect(result).toBeDefined();
      expect(result.email).toBe('test@example.com');
      expect(result.password).toBeUndefined();
    });

    it('should return null if user not found', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent@example.com', 'password');

      expect(result).toBeNull();
    });

    it('should return null if password is incorrect', async () => {
      const testUser = createTestUser();
      testUser.password = await bcrypt.hash('correctpassword', 10);
      prismaService.user.findUnique.mockResolvedValue(testUser);

      const result = await service.validateUser('test@example.com', 'wrongpassword');

      expect(result).toBeNull();
    });

    it('should return null if user is inactive', async () => {
      const testUser = createTestUser({ isActive: false });
      testUser.password = await bcrypt.hash('password', 10);
      prismaService.user.findUnique.mockResolvedValue(testUser);

      const result = await service.validateUser('test@example.com', 'password');

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return access and refresh tokens on successful login', async () => {
      const testUser = createTestUser();
      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      prismaService.session.create.mockResolvedValue({ id: 'session-id' });

      const result = await service.login(testUser, '127.0.0.1', 'Chrome');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
    });

    it('should create a session record', async () => {
      const testUser = createTestUser();
      jwtService.signAsync.mockResolvedValue('token');

      await service.login(testUser, '127.0.0.1', 'Firefox');

      expect(prismaService.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: testUser.id,
            ipAddress: '127.0.0.1',
            userAgent: 'Firefox',
          }),
        }),
      );
    });

    it('should log successful login to audit', async () => {
      const testUser = createTestUser();
      jwtService.signAsync.mockResolvedValue('token');
      prismaService.session.create.mockResolvedValue({ id: 'session-id' });

      await service.login(testUser, '127.0.0.1', 'Chrome');

      expect(auditService.logAuthEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN',
          userId: testUser.id,
          success: true,
        }),
      );
    });
  });

  describe('register', () => {
    it('should create a new user with hashed password', async () => {
      const registerDto = {
        email: 'new@example.com',
        password: 'securepassword123',
        name: 'New User',
      };

      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.create.mockResolvedValue(createTestUser({ email: registerDto.email }));

      const result = await service.register(registerDto);

      expect(result).toBeDefined();
      expect(prismaService.user.create).toHaveBeenCalled();

      const createCall = prismaService.user.create.mock.calls[0][0];
      expect(createCall.data.password).not.toBe('securepassword123');
    });

    it('should throw error if email already exists', async () => {
      prismaService.user.findUnique.mockResolvedValue(createTestUser());

      await expect(
        service.register({
          email: 'existing@example.com',
          password: 'password',
          name: 'User',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('refreshToken', () => {
    it('should return new access token for valid refresh token', async () => {
      const payload = { sub: 'user-id', email: 'test@example.com', type: 'refresh' };
      jwtService.verifyAsync.mockResolvedValue(payload);
      jwtService.signAsync.mockResolvedValue('new-access-token');
      prismaService.user.findUnique.mockResolvedValue(createTestUser());
      prismaService.session.findFirst.mockResolvedValue({ id: 'session-id', isValid: true });

      const result = await service.refreshToken('valid-refresh-token');

      expect(result).toHaveProperty('accessToken', 'new-access-token');
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      await expect(service.refreshToken('invalid-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for revoked session', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-id', type: 'refresh' });
      prismaService.session.findFirst.mockResolvedValue({ id: 'session-id', isValid: false });

      await expect(service.refreshToken('valid-but-revoked-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should invalidate the session', async () => {
      prismaService.session.updateMany.mockResolvedValue({ count: 1 });

      await service.logout('user-id', 'session-id');

      expect(prismaService.session.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-id', userId: 'user-id' },
          data: { isValid: false },
        }),
      );
    });

    it('should clear cached tokens', async () => {
      prismaService.session.updateMany.mockResolvedValue({ count: 1 });

      await service.logout('user-id', 'session-id');

      expect(cacheService.del).toHaveBeenCalled();
    });
  });

  describe('validateApiKey', () => {
    it('should return user for valid API key', async () => {
      const testUser = createTestUser();
      prismaService.apiKey = {
        findFirst: jest.fn().mockResolvedValue({
          id: 'key-id',
          key: 'valid-api-key',
          userId: testUser.id,
          isActive: true,
          expiresAt: new Date(Date.now() + 86400000),
          user: testUser,
        }),
      };

      const result = await service.validateApiKey('valid-api-key');

      expect(result).toBeDefined();
      expect(result.id).toBe(testUser.id);
    });

    it('should return null for expired API key', async () => {
      prismaService.apiKey = {
        findFirst: jest.fn().mockResolvedValue({
          id: 'key-id',
          key: 'expired-api-key',
          isActive: true,
          expiresAt: new Date(Date.now() - 86400000), // Expired yesterday
        }),
      };

      const result = await service.validateApiKey('expired-api-key');

      expect(result).toBeNull();
    });
  });

  describe('changePassword', () => {
    it('should update password when current password is correct', async () => {
      const testUser = createTestUser();
      testUser.password = await bcrypt.hash('currentPassword', 10);
      prismaService.user.findUnique.mockResolvedValue(testUser);
      prismaService.user.update.mockResolvedValue(testUser);

      await service.changePassword(testUser.id, 'currentPassword', 'newPassword123');

      expect(prismaService.user.update).toHaveBeenCalled();
    });

    it('should throw error when current password is incorrect', async () => {
      const testUser = createTestUser();
      testUser.password = await bcrypt.hash('currentPassword', 10);
      prismaService.user.findUnique.mockResolvedValue(testUser);

      await expect(
        service.changePassword(testUser.id, 'wrongPassword', 'newPassword123'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
