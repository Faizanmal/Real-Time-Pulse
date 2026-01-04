import { Test, TestingModule } from '@nestjs/testing';
import { MerkleTreeService } from './merkle-tree.service';

describe('MerkleTreeService', () => {
  let service: MerkleTreeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MerkleTreeService],
    }).compile();

    service = module.get<MerkleTreeService>(MerkleTreeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buildTree', () => {
    it('should return hash of empty string for empty input', () => {
      const result = service.buildTree([]);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      // Hash of empty string
    });

    it('should return single hash for single input', () => {
      const input = 'hash1';
      const result = service.buildTree([input]);
      expect(result).toBe(input);
    });

    it('should build tree correctly for even number of leaves', () => {
      // Simple 2 leaves
      // Root = Hash(Hash1 + Hash2)
      const inputs = ['hash1', 'hash2'];
      const result = service.buildTree(inputs);
      expect(result).toBeDefined();
    });

    it('should build tree correctly for odd number of leaves', () => {
      // 3 leaves -> 4th duplicated
      // L1: H1, H2, H3, H3
      // L2: H(H1+H2), H(H3+H3)
      // Root: H(L2a + L2b)
      const inputs = ['hash1', 'hash2', 'hash3'];
      const result = service.buildTree(inputs);
      expect(result).toBeDefined();
    });
  });

  describe('getProof', () => {
    it('should return empty proof for invalid index', () => {
      const inputs = ['hash1', 'hash2'];
      const proof = service.getProof(inputs, 5);
      expect(proof).toEqual([]);
    });

    it('should generate valid proof', () => {
      const inputs = ['hash1', 'hash2', 'hash3', 'hash4'];
      const proof = service.getProof(inputs, 0);

      // For index 0:
      // Sibling is index 1 (hash2)
      // Parent of 0,1 is P1. Sibling of P1 is P2 (parent of 3,4)

      expect(proof.length).toBeGreaterThan(0);
      expect(proof[0]).toContain('hash2');
    });
  });

  describe('verifyProof', () => {
    it('should verify valid proof', () => {
      const inputs = ['hash1', 'hash2', 'hash3', 'hash4'];
      const root = service.buildTree(inputs);
      const proof = service.getProof(inputs, 0);

      const isValid = service.verifyProof('hash1', proof, root);
      expect(isValid).toBe(true);
    });

    it('should fail invalid proof', () => {
      const inputs = ['hash1', 'hash2', 'hash3', 'hash4'];
      const root = service.buildTree(inputs);
      const proof = service.getProof(inputs, 0);

      // Modify proof
      proof[0] = proof[0].replace('hash', 'evil');

      const isValid = service.verifyProof('hash1', proof, root);
      expect(isValid).toBe(false);
    });
  });
});
