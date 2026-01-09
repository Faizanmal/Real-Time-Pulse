import { Test, TestingModule } from '@nestjs/testing';
import { WidgetService } from './widget.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { IntegrationService } from '../integrations/integration.service';

describe('WidgetService', () => {
  let service: WidgetService;
  let prisma: jest.Mocked<PrismaService>;
  // let cacheService: jest.Mocked<CacheService>;
  let integrationService: jest.Mocked<IntegrationService>;

  // const mockWidget = {
  //   id: 'widget-1',
  //   portalId: 'portal-1',
  //   integrationId: 'integration-1',
  //   type: 'CHART',
  //   title: 'Test Widget',
  //   config: { chartType: 'line' },
  //   position: { x: 0, y: 0, w: 4, h: 3 },
  //   isActive: true,
  //   createdAt: new Date(),
  //   updatedAt: new Date(),
  //   cachedData: null,
  //   dataCachedAt: null,
  // };

  const _mockIntegration = {
    id: 'integration-1',
    type: 'google_analytics',
    name: 'GA4 Integration',
    isActive: true,
    credentials: { viewId: '12345' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WidgetService,
        {
          provide: PrismaService,
          useValue: {
            widget: {
              findMany: jest.fn().mockResolvedValue([mockWidget]),
              findUnique: jest.fn().mockResolvedValue(mockWidget),
              create: jest.fn().mockResolvedValue(mockWidget),
              update: jest.fn().mockResolvedValue(mockWidget),
              delete: jest.fn().mockResolvedValue(mockWidget),
            },
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: IntegrationService,
          useValue: {
            fetchData: jest.fn().mockResolvedValue({
              success: true,
              data: [{ metric: 'pageviews', value: 1000 }],
            }),
          },
        },
      ],
    }).compile();

    service = module.get<WidgetService>(WidgetService);
    prisma = module.get(PrismaService);
    cacheService = module.get(CacheService);
    integrationService = module.get(IntegrationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllByPortal', () => {
    it('should return widgets for a portal', async () => {
      const result = await service.findAllByPortal('portal-1', 'workspace-1');
      expect(result).toEqual([mockWidget]);
      expect(prisma.widget.findMany).toHaveBeenCalledWith({
        where: { portalId: 'portal-1' },
        include: expect.any(Object),
        orderBy: { order: 'asc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a widget by id', async () => {
      const result = await service.findOne('widget-1', 'workspace-1');
      expect(result).toEqual(mockWidget);
      expect(prisma.widget.findUnique).toHaveBeenCalledWith({
        where: { id: 'widget-1' },
        include: { portal: true, integration: expect.any(Object) },
      });
    });
  });

  describe('create', () => {
    it('should create a widget', async () => {
      const createDto = {
        portalId: 'portal-1',
        integrationId: 'integration-1',
        type: 'CHART',
        title: 'New Widget',
        config: {},
        position: { x: 0, y: 0, w: 4, h: 3 },
      };

      const result = await service.create('workspace-1', createDto as any);
      expect(result).toEqual(mockWidget);
      expect(prisma.widget.create).toHaveBeenCalled();
    });
  });

  describe('refreshData', () => {
    it('should fetch data from integration and update widget', async () => {
      const result = await service.refreshData('widget-1', 'workspace-1');

      expect(integrationService.fetchData).toHaveBeenCalled();
      expect(prisma.widget.update).toHaveBeenCalled();
      expect(result.cachedData).toBeDefined();
    });

    it('should return fallback data when integration fails', async () => {
      jest.spyOn(integrationService, 'fetchData').mockResolvedValue({
        success: false,
        error: 'API error',
      });

      const result = await service.refreshData('widget-1', 'workspace-1');
      expect(result.cachedData).toBeDefined();
    });
  });

  describe('remove', () => {
    it('should delete a widget', async () => {
      await service.remove('widget-1', 'workspace-1');
      expect(prisma.widget.delete).toHaveBeenCalledWith({
        where: { id: 'widget-1' },
      });
    });
  });
});
