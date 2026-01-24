import { Test, TestingModule } from '@nestjs/testing';
import { ReportGeneratorService } from './report-generator.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { ClientReportService } from './client-report.service';

describe('ReportGeneratorService', () => {
  let service: ReportGeneratorService;
  let clientReportService: jest.Mocked<ClientReportService>;
  let emailService: jest.Mocked<EmailService>;

  const mockReport = {
    id: 'report-1',
    title: 'Monthly Report',
    reportType: 'ANALYTICS',
    clientName: 'Acme Corp',
    projectId: 'project-1',
    workspaceId: 'workspace-1',
    recipientEmails: ['test@example.com'],
    status: 'SCHEDULED',
    aiGenerated: false,
    keyInsights: [],
    metrics: {},
    recommendations: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    project: {
      name: 'Project X',
      profitability: {
        totalRevenue: 1000,
        totalCosts: 500,
        grossProfit: 500,
        profitMargin: 50,
        utilizationRate: 80,
      },
      timeEntries: [],
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
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: ClientReportService,
          useValue: {
            getScheduledReports: jest.fn().mockResolvedValue([mockReport]),
            getReportById: jest.fn().mockResolvedValue(mockReport),
            updateReport: jest.fn().mockResolvedValue(mockReport),
            markAsSent: jest.fn().mockResolvedValue(mockReport),
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
    clientReportService = module.get(ClientReportService);
    emailService = module.get(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processScheduledReports', () => {
    it('should process scheduled reports', async () => {
      await service.processScheduledReports();
      expect(clientReportService.getScheduledReports).toHaveBeenCalled();
      expect(clientReportService.updateReport).toHaveBeenCalled();
      expect(emailService.sendEmail).toHaveBeenCalled();
      expect(clientReportService.markAsSent).toHaveBeenCalled();
    });
  });

  describe('generateAndSendReport', () => {
    it('should generate and send report', async () => {
      await service.generateAndSendReport('report-1');
      expect(clientReportService.getReportById).toHaveBeenCalledWith('report-1');
      expect(clientReportService.updateReport).toHaveBeenCalled();
      expect(emailService.sendEmail).toHaveBeenCalled();
    });
  });
});
