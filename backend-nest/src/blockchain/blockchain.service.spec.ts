import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainService } from './blockchain.service';
import { MerkleTreeService } from './merkle-tree.service';
import { CacheService } from '../cache/cache.service';

describe('BlockchainService', () => {
  let service: BlockchainService;
  let cacheService: Partial<CacheService>;
  let _merkleService: MerkleTreeService;

  // Mock storage
  const mockStorage: Record<string, string> = {};

  beforeEach(async () => {
    mockStorage['blockchain:test-workspace:chain'] = JSON.stringify([]);
    mockStorage['blockchain:test-workspace:pending'] = JSON.stringify([]);

    cacheService = {
      get: jest.fn().mockImplementation(async (key) => mockStorage[key]),
      set: jest.fn().mockImplementation(async (key, value) => {
        mockStorage[key] = value;
      }),
      del: jest.fn().mockImplementation(async (key) => {
        delete mockStorage[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainService,
        MerkleTreeService,
        { provide: CacheService, useValue: cacheService },
      ],
    }).compile();

    service = module.get<BlockchainService>(BlockchainService);
    _merkleService = module.get<MerkleTreeService>(MerkleTreeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAuditEntry', () => {
    it('should create and store an audit entry', async () => {
      const entryData = {
        entityType: 'widget',
        entityId: '123',
        action: 'create',
        userId: 'user-1',
        data: { foo: 'bar' },
      };

      const entry = await service.createAuditEntry('test-workspace', entryData);

      expect(entry).toBeDefined();
      expect(entry.id).toContain('audit_');
      expect(entry.hash).toBeDefined();
      expect(cacheService.set).toHaveBeenCalled();

      // Verify stored pending
      const pendingJson = mockStorage['blockchain:test-workspace:pending'];
      const pending = JSON.parse(pendingJson);
      expect(pending).toHaveLength(1);
      expect(pending[0].entityId).toBe('123');
    });
  });

  describe('createBlock', () => {
    it('should create a block from pending entries', async () => {
      // Add pending entry
      await service.createAuditEntry('test-workspace', {
        entityType: 'widget',
        entityId: '123',
        action: 'create',
        userId: 'user-1',
        data: {},
      });

      const block = await service.createBlock('test-workspace');

      expect(block).toBeDefined();
      expect(block?.data).toHaveLength(1);
      expect(block?.hash).toMatch(/^00/); // Difficulty 2 check
      expect(block?.merkleRoot).toBeDefined();

      // Verify chain storage
      const chainJson = mockStorage['blockchain:test-workspace:chain'];
      const chain = JSON.parse(chainJson);
      expect(chain).toHaveLength(1);
      expect(chain[0].id).toBe(block?.id);

      // Verify pending cleared
      expect(mockStorage['blockchain:test-workspace:pending']).toBeUndefined();
    });

    it('should return null if no pending entries', async () => {
      const block = await service.createBlock('test-workspace');
      expect(block).toBeNull();
    });
  });

  describe('verifyChainIntegrity', () => {
    it('should confirm valid chain', async () => {
      // Create a few blocks
      await service.createAuditEntry('test-workspace', {
        entityType: 'a',
        entityId: '1',
        action: 'c',
        userId: 'u',
        data: {},
      });
      await service.createBlock('test-workspace');

      await service.createAuditEntry('test-workspace', {
        entityType: 'b',
        entityId: '2',
        action: 'u',
        userId: 'u',
        data: {},
      });
      await service.createBlock('test-workspace');

      const verification = await service.verifyChainIntegrity('test-workspace');

      expect(verification.isValid).toBe(true);
      expect(verification.blocksVerified).toBe(2);
    });

    it('should detect tampered block data', async () => {
      // Create block
      await service.createAuditEntry('test-workspace', {
        entityType: 'a',
        entityId: '1',
        action: 'c',
        userId: 'u',
        data: {},
      });
      await service.createBlock('test-workspace');

      // Tamper with storage
      const chain = JSON.parse(mockStorage['blockchain:test-workspace:chain']);
      chain[0].data[0].action = 'evil_action'; // Modify data
      mockStorage['blockchain:test-workspace:chain'] = JSON.stringify(chain);

      const verification = await service.verifyChainIntegrity('test-workspace');

      expect(verification.isValid).toBe(false);
      expect(verification.invalidBlocks).toHaveLength(1);
    });
  });

  describe('verifyEntry', () => {
    it('should verify existing entry in block', async () => {
      const entry = await service.createAuditEntry('test-workspace', {
        entityType: 'a',
        entityId: '1',
        action: 'c',
        userId: 'u',
        data: {},
      });
      await service.createBlock('test-workspace');

      const result = await service.verifyEntry('test-workspace', entry.id);

      expect(result.exists).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.block).toBeDefined();
      expect(result.proof).toBeDefined();
    });

    it('should return valid=false for tampered entry', async () => {
      const entry = await service.createAuditEntry('test-workspace', {
        entityType: 'a',
        entityId: '1',
        action: 'c',
        userId: 'u',
        data: {},
      });
      await service.createBlock('test-workspace');

      // Tamper with storage
      const chain = JSON.parse(mockStorage['blockchain:test-workspace:chain']);
      // We can't easily tamper with just the entry hash without breaking the block hash
      // But if we tamper with the data, the re-calculated entry hash won't match the stored one
      chain[0].data[0].data = { evil: true };
      mockStorage['blockchain:test-workspace:chain'] = JSON.stringify(chain);

      const result = await service.verifyEntry('test-workspace', entry.id);

      expect(result.exists).toBe(true);
      // The entry hash check should fail because the data changed
      expect(result.valid).toBe(false);
    });
  });
});
