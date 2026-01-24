import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Generate a secure random API key
   */
  private generateApiKey(): { key: string; hash: string; prefix: string } {
    const prefix = 'rtp_'; // Real-Time Pulse prefix
    const randomBytes = crypto.randomBytes(32).toString('hex');
    const key = `${prefix}${randomBytes}`;
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    const keyPrefix = key.substring(0, 12);
    return { key, hash, prefix: keyPrefix };
  }

  /**
   * Create a new API key
   */
  async createApiKey(userId: string, workspaceId: string, dto: CreateApiKeyDto) {
    const { key, hash, prefix } = this.generateApiKey();

    const apiKey = await this.prisma.apiKey.create({
      data: {
        name: dto.name,
        keyHash: hash,
        keyPrefix: prefix,
        scopes: dto.scopes,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        workspaceId,
        userId,
      },
    });

    // Log the creation
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    await this.auditService.log({
      action: 'API_KEY_CREATED',
      entity: 'ApiKey',
      entityId: apiKey.id,
      userId,
      workspaceId,
      userEmail: user?.email || '',
      method: 'POST',
      endpoint: '/api-keys',
      metadata: { name: dto.name, scopes: dto.scopes },
    });

    // Return the full key only once during creation
    return {
      id: apiKey.id,
      name: apiKey.name,
      key, // Full key - only returned on creation
      keyPrefix: apiKey.keyPrefix,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
    };
  }

  /**
   * Get all API keys for a workspace
   */
  async getApiKeys(workspaceId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: {
        workspaceId,
        revokedAt: null,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    return keys;
  }

  /**
   * Get a single API key
   */
  async getApiKey(id: string, workspaceId: string) {
    const key = await this.prisma.apiKey.findFirst({
      where: {
        id,
        workspaceId,
        revokedAt: null,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    if (!key) {
      throw new NotFoundException('API key not found');
    }

    return key;
  }

  /**
   * Delete an API key
   */
  async deleteApiKey(id: string, workspaceId: string, userId: string) {
    const key = await this.prisma.apiKey.findFirst({
      where: {
        id,
        workspaceId,
        revokedAt: null,
      },
    });

    if (!key) {
      throw new NotFoundException('API key not found');
    }

    await this.prisma.apiKey.update({
      where: { id },
      data: {
        revokedAt: new Date(),
        isActive: false,
      },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    await this.auditService.log({
      action: 'API_KEY_DELETED',
      entity: 'ApiKey',
      entityId: id,
      userId,
      workspaceId,
      userEmail: user?.email || '',
      method: 'DELETE',
      endpoint: '/api-keys',
      metadata: { name: key.name },
    });
  }

  /**
   * Regenerate an API key
   */
  async regenerateApiKey(id: string, workspaceId: string, userId: string) {
    const existingKey = await this.prisma.apiKey.findFirst({
      where: {
        id,
        workspaceId,
        revokedAt: null,
        isActive: true,
      },
    });

    if (!existingKey) {
      throw new NotFoundException('API key not found');
    }

    const { key, hash, prefix } = this.generateApiKey();

    const updatedKey = await this.prisma.apiKey.update({
      where: { id },
      data: {
        keyHash: hash,
        keyPrefix: prefix,
      },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    await this.auditService.log({
      action: 'API_KEY_REGENERATED',
      entity: 'ApiKey',
      entityId: id,
      userId,
      workspaceId,
      userEmail: user?.email || '',
      method: 'PUT',
      endpoint: '/api-keys/regenerate',
      metadata: { name: existingKey.name },
    });

    return {
      id: updatedKey.id,
      name: updatedKey.name,
      key, // Full key - only returned on regeneration
      keyPrefix: updatedKey.keyPrefix,
      scopes: updatedKey.scopes,
      expiresAt: updatedKey.expiresAt,
    };
  }

  /**
   * Validate an API key and return the associated workspace
   */
  async validateApiKey(apiKey: string): Promise<{ workspaceId: string; scopes: string[] } | null> {
    const hash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const key = await this.prisma.apiKey.findFirst({
      where: {
        keyHash: hash,
        revokedAt: null,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    if (!key) {
      return null;
    }

    // Update last used timestamp
    await this.prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      workspaceId: key.workspaceId,
      scopes: key.scopes,
    };
  }
}
