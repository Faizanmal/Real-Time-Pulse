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
    const response = await apiClient.post<BlockchainAuditEntry>('/blockchain/audit', data);
    return response;
  },

  forceCreateBlock: async (): Promise<Block> => {
    const response = await apiClient.post<Block>('/blockchain/block');
    return response;
  },

  verifyChain: async (): Promise<BlockchainVerification> => {
    const response = await apiClient.get<BlockchainVerification>('/blockchain/verify');
    return response;
  },

  verifyEntry: async (entryId: string): Promise<{ valid: boolean; entry: BlockchainAuditEntry }> => {
    const response = await apiClient.get<{ valid: boolean; entry: BlockchainAuditEntry }>(`/blockchain/verify/${entryId}`);
    return response;
  },

  getAuditTrail: async (entityType: string, entityId: string): Promise<BlockchainAuditEntry[]> => {
    const response = await apiClient.get<BlockchainAuditEntry[]>(`/blockchain/audit/${entityType}/${entityId}`);
    return response;
  },

  getAllAuditEntries: async (): Promise<BlockchainAuditEntry[]> => {
    const response = await apiClient.get<BlockchainAuditEntry[]>('/blockchain/audit');
    return response;
  },

  getBlocks: async (): Promise<Block[]> => {
    const response = await apiClient.get<Block[]>('/blockchain/blocks');
    return response;
  },

  verifyChainIntegrity: async (): Promise<BlockchainVerification> => {
    const response = await apiClient.get<BlockchainVerification>('/blockchain/verify');
    return response;
  },

  generateComplianceReport: async (params: {
    type?: string;
    framework?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ComplianceReport> => {
    const response = await apiClient.get<ComplianceReport>('/blockchain/compliance', { params });
    return response;
  },

  exportBlockchain: async (): Promise<{ blocks: Block[]; checksum: string }> => {
    const response = await apiClient.get<{ blocks: Block[]; checksum: string }>('/blockchain/export');
    return response;
  },

  importBlockchain: async (data: { blocks: Block[]; checksum: string }): Promise<{ success: boolean }> => {
    const response = await apiClient.post<{ success: boolean }>('/blockchain/import', data);
    return response;
  },

  verifyMerkleProof: async (data: { leaf: string; proof: string[]; root: string }): Promise<MerkleProof> => {
    const response = await apiClient.post<MerkleProof>('/blockchain/merkle/verify', data);
    return response;
  },

  buildMerkleTree: async (hashes: string[]): Promise<{ root: string; tree: string[][] }> => {
    const response = await apiClient.post<{ root: string; tree: string[][] }>('/blockchain/merkle/tree', { hashes });
    return response;
  },
};

