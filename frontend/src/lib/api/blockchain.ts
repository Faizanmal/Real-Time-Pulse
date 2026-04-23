'use client';

import { apiClient } from './client';

export interface BlockchainAuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  userId: string;
  workspaceId: string;
  data: Record<string, unknown>;
  hash: string;
  previousHash: string;
  blockNumber: number;
  timestamp: string;
  verified: boolean;
  description?: string;
}

export interface Block {
  number: number;
  hash: string;
  previousHash: string;
  timestamp: string;
  entries: BlockchainAuditEntry[];
  merkleRoot: string;
  id?: string;
  index?: number;
  entriesCount?: number;
  createdAt?: string;
  nonce?: number;
}

export interface BlockchainVerification {
  valid: boolean;
  totalBlocks: number;
  totalEntries: number;
  lastVerified: string;
  errors?: { blockNumber: number; error: string }[];
  entry?: BlockchainAuditEntry;
  error?: string;
}

export interface ComplianceReport {
  id: string;
  type: string;
  framework: string;
  startDate: string;
  endDate: string;
  generatedAt: string;
  status: 'pending' | 'completed' | 'failed';
  summary: {
    totalEntries: number;
    verifiedEntries: number;
    failedEntries: number;
  };
  downloadUrl?: string;
}

export interface MerkleProof {
  leaf: string;
  proof: string[];
  root: string;
  valid: boolean;
}

export const blockchainApi = {
  createAuditEntry: async (data: {
    entityType: string;
    entityId: string;
    action: string;
    data: Record<string, unknown>;
  }): Promise<BlockchainAuditEntry> => {
    return await apiClient.post<BlockchainAuditEntry>('/blockchain/audit', data);
  },

  forceCreateBlock: async (): Promise<Block> => {
    return await apiClient.post<Block>('/blockchain/block');
  },

  verifyChain: async (): Promise<BlockchainVerification> => {
    return await apiClient.get<BlockchainVerification>('/blockchain/verify');
  },

  verifyEntry: async (entryId: string): Promise<{ valid: boolean; entry: BlockchainAuditEntry }> => {
    return await apiClient.get<{ valid: boolean; entry: BlockchainAuditEntry }>(`/blockchain/verify/${entryId}`);
  },

  getAuditTrail: async (entityType: string, entityId: string): Promise<BlockchainAuditEntry[]> => {
    return await apiClient.get<BlockchainAuditEntry[]>(`/blockchain/audit/${entityType}/${entityId}`);
  },

  getAllAuditEntries: async (): Promise<BlockchainAuditEntry[]> => {
    return await apiClient.get<BlockchainAuditEntry[]>('/blockchain/audit');
  },

  getBlocks: async (): Promise<Block[]> => {
    return await apiClient.get<Block[]>('/blockchain/blocks');
  },

  verifyChainIntegrity: async (): Promise<BlockchainVerification> => {
    return await apiClient.get<BlockchainVerification>('/blockchain/verify');
  },

  generateComplianceReport: async (params: {
    type?: string;
    framework?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ComplianceReport> => {
    return await apiClient.get<ComplianceReport>('/blockchain/compliance', { params });
  },

  exportBlockchain: async (): Promise<{ blocks: Block[]; checksum: string }> => {
    return await apiClient.get<{ blocks: Block[]; checksum: string }>('/blockchain/export');
  },

  importBlockchain: async (data: { blocks: Block[]; checksum: string }): Promise<{ success: boolean }> => {
    return await apiClient.post<{ success: boolean }>('/blockchain/import', data);
  },

  verifyMerkleProof: async (data: { leaf: string; proof: string[]; root: string }): Promise<MerkleProof> => {
    return await apiClient.post<MerkleProof>('/blockchain/merkle/verify', data);
  },

  buildMerkleTree: async (hashes: string[]): Promise<{ root: string; tree: string[][] }> => {
    return await apiClient.post<{ root: string; tree: string[][] }>('/blockchain/merkle/tree', { hashes });
  },
};

