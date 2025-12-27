import { Test, TestingModule } from '@nestjs/testing';
import { ReportGeneratorService } from './report-generator.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

describe('ReportGeneratorService', () => {
  let service: ReportGeneratorService;
  let prisma: jest.Mocked<PrismaService>;
  let emailService: jest.Mocked<EmailService>;

  const mockReport = {
    id: 'report-1',
    name: 'Monthly Report',
    type: 'analytics',
    schedule: 'monthly',
    workspaceId: 'workspace-1',
    recipients: ['test@example.com'],
    config: { dateRange: 'last_30_days' },
    isActive: true,
    lastRun: null,
    nextRun: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockWorkspace = {
    id: 'workspace-1',
    name: 'Test Workspace',
    owner: {
      id: 'user-1',
      email: 'owner@example.com',
      firstName: 'Test',
      lastName: 'Owner',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportGeneratorService,
        {
          provide: PrismaService,
          useValue: {
            clientReport: {
              findUnique: jest.fn().mockResolvedValue(mockReport),
              findMany: jest.fn().mockResolvedValue([mockReport]),
              create: jest.fn().mockResolvedValue(mockReport),
              update: jest.fn().mockResolvedValue(mockReport),
              delete: jest.fn().mockResolvedValue(mockReport),
            },
            workspace: {
              findUnique: jest.fn().mockResolvedValue(mockWorkspace),
            },
            analytics: {
              findMany: jest.fn().mockResolvedValue([
                { metric: 'pageviews', value: 1000, timestamp: new Date() },
                { metric: 'sessions', value: 500, timestamp: new Date() },
              ]),
            },
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendEmail: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<ReportGeneratorService>(ReportGeneratorService);
    prisma = module.get(PrismaService);
    emailService = module.get(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return a report by id', async () => {
      const result = await service.findOne('report-1');
      expect(result).toEqual(mockReport);
      expect(prisma.clientReport.findUnique).toHaveBeenCalledWith({
        where: { id: 'report-1' },
      });
    });
  });

  describe('findByWorkspace', () => {
    it('should return reports for a workspace', async () => {
      const result = await service.findByWorkspace('workspace-1');
      expect(result).toEqual([mockReport]);
      expect(prisma.clientReport.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'workspace-1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('create', () => {
    it('should create a report', async () => {
      const createDto = {
        name: 'New Report',
        type: 'analytics',
        schedule: 'weekly',
        workspaceId: 'workspace-1',
        recipients: ['test@example.com'],
        config: {},
      };

      const result = await service.create(createDto as any);
      expect(result).toEqual(mockReport);
      expect(prisma.clientReport.create).toHaveBeenCalled();
    });
  });

  describe('generateReport', () => {
    it('should generate report data', async () => {
      const result = await service.generateReport('report-1');
      
      expect(result).toBeDefined();
      expect(result.reportId).toBe('report-1');
      expect(result.data).toBeDefined();
    });
  });

  describe('sendReport', () => {
    it('should send report via email', async () => {
      const reportData = {
        reportId: 'report-1',
        reportName: 'Monthly Report',
        generatedAt: new Date().toISOString(),
        data: {
          summary: { totalMetrics: 2 },
          metrics: [
            { name: 'pageviews', value: 1000 },
            { name: 'sessions', value: 500 },
          ],
        },
      };

      await service.sendReport(
        'report-1',
        reportData,
        ['test@example.com']
      );

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: expect.stringContaining('Monthly Report'),
        })
      );
    });

    it('should send to multiple recipients', async () => {
      const reportData = {
        reportId: 'report-1',
        reportName: 'Monthly Report',
        generatedAt: new Date().toISOString(),
        data: {},
      };

      await service.sendReport(
        'report-1',
        reportData,
        ['user1@example.com', 'user2@example.com']
      );

      expect(emailService.sendEmail).toHaveBeenCalledTimes(2);
    });
  });

  describe('delete', () => {
    it('should delete a report', async () => {
      await service.delete('report-1');
      expect(prisma.clientReport.delete).toHaveBeenCalledWith({
        where: { id: 'report-1' },
      });
    });
  });
});
