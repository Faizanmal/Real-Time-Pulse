import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { CacheService } from '../cache/cache.service';
import { MerkleTreeService } from './merkle-tree.service';

export interface AuditBlock {
  id: string;
  timestamp: Date;
  previousHash: string;
  hash: string;
  data: AuditEntry[];
  nonce: number;
  merkleRoot: string;
}

export interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  userId: string;
  data: Record<string, any>;
  timestamp: Date;
  hash: string;
}

export interface IntegrityVerification {
  isValid: boolean;
  blocksVerified: number;
  entriesVerified: number;
  invalidBlocks: string[];
  invalidEntries: string[];
  verifiedAt: Date;
}

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private readonly blockSize = 100; // Entries per block
  private readonly difficulty = 2; // Proof-of-work difficulty

  constructor(
    private readonly cache: CacheService,
    private readonly merkleService: MerkleTreeService,
  ) {}

  /**
   * Create a new audit entry with cryptographic hash
   */
  async createAuditEntry(
    workspaceId: string,
    entry: {
      entityType: string;
      entityId: string;
      action: string;
      userId: string;
      data: Record<string, any>;
    },
  ): Promise<AuditEntry> {
    const auditEntry: AuditEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...entry,
      timestamp: new Date(),
      hash: '',
    };

    // Generate hash of entry
    auditEntry.hash = this.hashEntry(auditEntry);

    // Add to pending entries
    await this.addToPendingEntries(workspaceId, auditEntry);

    // Check if we should create a new block
    const pendingCount = await this.getPendingEntriesCount(workspaceId);
    if (pendingCount >= this.blockSize) {
      await this.createBlock(workspaceId);
    }

    return auditEntry;
  }

  /**
   * Create a new block from pending entries
   */
  async createBlock(workspaceId: string): Promise<AuditBlock | null> {
    const pendingEntries = await this.getPendingEntries(workspaceId);

    if (pendingEntries.length === 0) {
      return null;
    }

    // Get previous block
    const chain = await this.getChain(workspaceId);
    const previousBlock = chain[chain.length - 1];
    const previousHash = previousBlock?.hash || '0'.repeat(64);

    // Build merkle tree
    const entryHashes = pendingEntries.map((e) => e.hash);
    const merkleRoot = this.merkleService.buildTree(entryHashes);

    // Create block with proof-of-work
    let nonce = 0;
    let hash: string;
    const blockData = {
      timestamp: new Date(),
      previousHash,
      merkleRoot,
      data: pendingEntries,
    };

    do {
      nonce++;
      hash = this.hashBlock(blockData, nonce);
    } while (!hash.startsWith('0'.repeat(this.difficulty)));

    const block: AuditBlock = {
      id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: blockData.timestamp,
      previousHash,
      hash,
      data: pendingEntries,
      nonce,
      merkleRoot,
    };

    // Add block to chain
    chain.push(block);
    await this.saveChain(workspaceId, chain);

    // Clear pending entries
    await this.clearPendingEntries(workspaceId);

    this.logger.log(`Created block ${block.id} with ${pendingEntries.length} entries`);

    return block;
  }

  /**
   * Verify entire blockchain integrity
   */
  async verifyChainIntegrity(workspaceId: string): Promise<IntegrityVerification> {
    const chain = await this.getChain(workspaceId);
    const invalidBlocks: string[] = [];
    const invalidEntries: string[] = [];
    let entriesVerified = 0;

    for (let i = 0; i < chain.length; i++) {
      const block = chain[i];

      // Verify block hash
      const calculatedHash = this.hashBlock(
        {
          timestamp: new Date(block.timestamp),
          previousHash: block.previousHash,
          merkleRoot: block.merkleRoot,
          data: block.data,
        },
        block.nonce,
      );

      if (calculatedHash !== block.hash) {
        invalidBlocks.push(block.id);
        continue;
      }

      // Verify previous hash link
      if (i > 0 && block.previousHash !== chain[i - 1].hash) {
        invalidBlocks.push(block.id);
        continue;
      }

      // Verify merkle root
      const entryHashes = block.data.map((e) => e.hash);
      const calculatedMerkle = this.merkleService.buildTree(entryHashes);
      if (calculatedMerkle !== block.merkleRoot) {
        invalidBlocks.push(block.id);
        continue;
      }

      // Verify each entry
      for (const entry of block.data) {
        const calculatedEntryHash = this.hashEntry(entry);
        if (calculatedEntryHash !== entry.hash) {
          invalidEntries.push(entry.id);
        }
        entriesVerified++;
      }
    }

    return {
      isValid: invalidBlocks.length === 0 && invalidEntries.length === 0,
      blocksVerified: chain.length,
      entriesVerified,
      invalidBlocks,
      invalidEntries,
      verifiedAt: new Date(),
    };
  }

  /**
   * Verify a specific entry exists and is valid
   */
  async verifyEntry(
    workspaceId: string,
    entryId: string,
  ): Promise<{
    exists: boolean;
    valid: boolean;
    block?: AuditBlock;
    entry?: AuditEntry;
    proof?: string[];
  }> {
    const chain = await this.getChain(workspaceId);

    for (const block of chain) {
      const entryIndex = block.data.findIndex((e) => e.id === entryId);
      if (entryIndex !== -1) {
        const entry = block.data[entryIndex];

        // Verify entry hash
        const calculatedHash = this.hashEntry(entry);
        const valid = calculatedHash === entry.hash;

        // Generate merkle proof
        const proof = this.merkleService.getProof(
          block.data.map((e) => e.hash),
          entryIndex,
        );

        return {
          exists: true,
          valid,
          block,
          entry,
          proof,
        };
      }
    }

    // Check pending entries
    const pending = await this.getPendingEntries(workspaceId);
    const pendingEntry = pending.find((e) => e.id === entryId);
    if (pendingEntry) {
      return {
        exists: true,
        valid: this.hashEntry(pendingEntry) === pendingEntry.hash,
        entry: pendingEntry,
      };
    }

    return { exists: false, valid: false };
  }

  /**
   * Get audit trail for an entity
   */
  async getEntityAuditTrail(
    workspaceId: string,
    entityType: string,
    entityId: string,
  ): Promise<AuditEntry[]> {
    const chain = await this.getChain(workspaceId);
    const entries: AuditEntry[] = [];

    for (const block of chain) {
      for (const entry of block.data) {
        if (entry.entityType === entityType && entry.entityId === entityId) {
          entries.push(entry);
        }
      }
    }

    // Also check pending
    const pending = await this.getPendingEntries(workspaceId);
    for (const entry of pending) {
      if (entry.entityType === entityType && entry.entityId === entityId) {
        entries.push(entry);
      }
    }

    return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    workspaceId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      entityTypes?: string[];
      actions?: string[];
    } = {},
  ): Promise<{
    summary: Record<string, any>;
    entries: AuditEntry[];
    integrity: IntegrityVerification;
    generatedAt: Date;
    signature: string;
  }> {
    const chain = await this.getChain(workspaceId);
    const entries: AuditEntry[] = [];

    const startTime = options.startDate?.getTime() || 0;
    const endTime = options.endDate?.getTime() || Date.now();

    for (const block of chain) {
      for (const entry of block.data) {
        const entryTime = new Date(entry.timestamp).getTime();

        if (entryTime < startTime || entryTime > endTime) continue;
        if (options.entityTypes && !options.entityTypes.includes(entry.entityType)) continue;
        if (options.actions && !options.actions.includes(entry.action)) continue;

        entries.push(entry);
      }
    }

    // Generate summary
    const summary = {
      totalEntries: entries.length,
      byEntityType: this.groupBy(entries, 'entityType'),
      byAction: this.groupBy(entries, 'action'),
      byUser: this.groupBy(entries, 'userId'),
      dateRange: {
        start: options.startDate || new Date(Math.min(...entries.map((e) => new Date(e.timestamp).getTime()))),
        end: options.endDate || new Date(Math.max(...entries.map((e) => new Date(e.timestamp).getTime()))),
      },
    };

    // Verify integrity
    const integrity = await this.verifyChainIntegrity(workspaceId);

    // Generate report signature
    const reportData = JSON.stringify({ summary, entries, integrity });
    const signature = crypto.createHash('sha256').update(reportData).digest('hex');

    return {
      summary,
      entries,
      integrity,
      generatedAt: new Date(),
      signature,
    };
  }

  /**
   * Export blockchain for external verification
   */
  async exportChain(workspaceId: string): Promise<{
    version: string;
    exportedAt: Date;
    chain: AuditBlock[];
    pendingEntries: AuditEntry[];
    checksum: string;
  }> {
    const chain = await this.getChain(workspaceId);
    const pendingEntries = await this.getPendingEntries(workspaceId);

    const exportData = {
      version: '1.0',
      exportedAt: new Date(),
      chain,
      pendingEntries,
      checksum: '',
    };

    // Generate checksum
    exportData.checksum = crypto
      .createHash('sha256')
      .update(JSON.stringify({ chain, pendingEntries }))
      .digest('hex');

    return exportData;
  }

  /**
   * Import blockchain (for verification/migration)
   */
  async importChain(
    workspaceId: string,
    data: {
      chain: AuditBlock[];
      pendingEntries: AuditEntry[];
      checksum: string;
    },
  ): Promise<boolean> {
    // Verify checksum
    const calculatedChecksum = crypto
      .createHash('sha256')
      .update(JSON.stringify({ chain: data.chain, pendingEntries: data.pendingEntries }))
      .digest('hex');

    if (calculatedChecksum !== data.checksum) {
      throw new Error('Import checksum verification failed');
    }

    // Verify chain integrity before importing
    const tempChain = data.chain;
    for (let i = 1; i < tempChain.length; i++) {
      if (tempChain[i].previousHash !== tempChain[i - 1].hash) {
        throw new Error(`Chain integrity verification failed at block ${i}`);
      }
    }

    // Import
    await this.saveChain(workspaceId, data.chain);
    await this.savePendingEntries(workspaceId, data.pendingEntries);

    return true;
  }

  // Private helper methods

  private hashEntry(entry: AuditEntry): string {
    const data = {
      id: entry.id,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      userId: entry.userId,
      data: entry.data,
      timestamp: entry.timestamp,
    };
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  private hashBlock(data: any, nonce: number): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify({ ...data, nonce }))
      .digest('hex');
  }

  private async getChain(workspaceId: string): Promise<AuditBlock[]> {
    const key = `blockchain:${workspaceId}:chain`;
    const chainJson = await this.cache.get(key);
    return chainJson ? JSON.parse(chainJson) : [];
  }

  private async saveChain(workspaceId: string, chain: AuditBlock[]): Promise<void> {
    const key = `blockchain:${workspaceId}:chain`;
    await this.cache.set(key, JSON.stringify(chain), 86400 * 365 * 10); // 10 years
  }

  private async getPendingEntries(workspaceId: string): Promise<AuditEntry[]> {
    const key = `blockchain:${workspaceId}:pending`;
    const entriesJson = await this.cache.get(key);
    return entriesJson ? JSON.parse(entriesJson) : [];
  }

  private async savePendingEntries(workspaceId: string, entries: AuditEntry[]): Promise<void> {
    const key = `blockchain:${workspaceId}:pending`;
    await this.cache.set(key, JSON.stringify(entries), 86400 * 365);
  }

  private async addToPendingEntries(workspaceId: string, entry: AuditEntry): Promise<void> {
    const entries = await this.getPendingEntries(workspaceId);
    entries.push(entry);
    await this.savePendingEntries(workspaceId, entries);
  }

  private async getPendingEntriesCount(workspaceId: string): Promise<number> {
    const entries = await this.getPendingEntries(workspaceId);
    return entries.length;
  }

  private async clearPendingEntries(workspaceId: string): Promise<void> {
    const key = `blockchain:${workspaceId}:pending`;
    await this.cache.delete(key);
  }

  private groupBy(entries: AuditEntry[], field: keyof AuditEntry): Record<string, number> {
    return entries.reduce(
      (acc, entry) => {
        const key = String(entry[field]);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }
}
