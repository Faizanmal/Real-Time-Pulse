import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';

describe('NotificationService', () => {
  let service: NotificationService;
  let prisma: jest.Mocked<PrismaService>;
  let emailService: jest.Mocked<EmailService>;
  let httpService: jest.Mocked<HttpService>;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    phone: '+1234567890',
    pushTokens: [
      { token: 'token-1', platform: 'web', isActive: true },
      { token: 'token-2', platform: 'ios', isActive: true },
    ],
  };

  const mockWorkspace = {
    id: 'workspace-1',
    name: 'Test Workspace',
    ownerId: 'user-1',
    members: [{ userId: 'user-1' }],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn().mockResolvedValue(mockUser),
            },
            pushToken: {
              findMany: jest.fn().mockResolvedValue(mockUser.pushTokens),
            },
            notification: {
              create: jest.fn().mockImplementation((data) => ({
                id: 'notif-1',
                ...data.data,
                createdAt: new Date(),
              })),
              findMany: jest.fn().mockResolvedValue([]),
              update: jest.fn().mockResolvedValue({}),
            },
            workspace: {
              findUnique: jest.fn().mockResolvedValue(mockWorkspace),
            },
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendEmail: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config: Record<string, string> = {
                'twilio.accountSid': 'test-sid',
                'twilio.authToken': 'test-token',
                'twilio.phoneNumber': '+10000000000',
                'slack.webhookUrl': 'https://hooks.slack.com/test',
                'firebase.serverKey': 'test-key',
              };
              return config[key];
            }),
          },
        },
        {
          provide: HttpService,
          useValue: {
            post: jest.fn().mockReturnValue(of({ status: 200 })),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    prisma = module.get(PrismaService);
    emailService = module.get(EmailService);
    httpService = module.get(HttpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserPushTokens', () => {
    it('should return active push tokens for a user', async () => {
      const tokens = await (service as any).getUserPushTokens('user-1');

      expect(tokens).toEqual(['token-1', 'token-2']);
      expect(prisma.pushToken.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isActive: true },
        select: { token: true },
      });
    });

    it('should return empty array when no tokens found', async () => {
      jest.spyOn(prisma.pushToken, 'findMany').mockResolvedValue([]);

      const tokens = await (service as any).getUserPushTokens('user-1');
      expect(tokens).toEqual([]);
    });
  });

  describe('getUserPhone', () => {
    it('should return user phone number', async () => {
      const phone = await (service as any).getUserPhone('user-1');

      expect(phone).toBe('+1234567890');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { phone: true },
      });
    });

    it('should return null when user has no phone', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        ...mockUser,
        phone: null,
      } as any);

      const phone = await (service as any).getUserPhone('user-1');
      expect(phone).toBeNull();
    });
  });

  describe('send', () => {
    it('should send email notification', async () => {
      const notification = {
        userId: 'user-1',
        type: 'ALERT' as const,
        title: 'Test Alert',
        message: 'This is a test',
        channels: ['email' as const],
        priority: 'high' as const,
      };

      await service.send({ ...notification, body: 'test body' });

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Test Alert',
        }),
      );
    });

    it('should send push notification', async () => {
      const notification = {
        userId: 'user-1',
        type: 'ALERT' as const,
        title: 'Test Alert',
        message: 'This is a test',
        channels: ['push' as const],
        priority: 'high' as const,
      };

      await service.send({ ...notification, body: 'test body' });

      expect(httpService.post).toHaveBeenCalled();
    });

    it('should send multi-channel notification', async () => {
      const notification = {
        userId: 'user-1',
        type: 'ALERT' as const,
        title: 'Test Alert',
        message: 'This is a test',
        channels: ['email' as const, 'push' as const],
        priority: 'high' as const,
      };

      await service.send({ ...notification, body: 'test body' });

      expect(emailService.sendEmail).toHaveBeenCalled();
      expect(httpService.post).toHaveBeenCalled();
    });
  });
});
