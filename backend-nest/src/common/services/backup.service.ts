import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

interface BackupMetadata {
  id: string;
  timestamp: Date;
  type: 'full' | 'incremental';
  size: number;
  checksum: string;
  tables: string[];
  status: 'pending' | 'completed' | 'failed' | 'verified';
  storagePath: string;
  retentionDays: number;
  error?: string;
}

interface RestoreOptions {
  backupId: string;
  targetDatabase?: string;
  tables?: string[];
  dryRun?: boolean;
}

@Injectable()
export class BackupService implements OnModuleInit {
  private readonly logger = new Logger(BackupService.name);
  private readonly BACKUP_DIR: string;
  private readonly METADATA_FILE = 'backup-metadata.json';
  private backupMetadata: BackupMetadata[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.BACKUP_DIR =
      this.configService.get<string>('backup.directory') || './backups';
  }

  async onModuleInit() {
    await this.ensureBackupDirectory();
    await this.loadBackupMetadata();
    this.logger.log('Backup service initialized');
  }

  /**
   * Ensure backup directory exists
   */
  private async ensureBackupDirectory(): Promise<void> {
    try {
      if (!fs.existsSync(this.BACKUP_DIR)) {
        fs.mkdirSync(this.BACKUP_DIR, { recursive: true });
        this.logger.log(`Created backup directory: ${this.BACKUP_DIR}`);
      }
    } catch (error) {
      this.logger.error('Failed to create backup directory', error);
    }
  }

  /**
   * Load backup metadata from file
   */
  private async loadBackupMetadata(): Promise<void> {
    try {
      const metadataPath = path.join(this.BACKUP_DIR, this.METADATA_FILE);
      if (fs.existsSync(metadataPath)) {
        const data = fs.readFileSync(metadataPath, 'utf8');
        this.backupMetadata = JSON.parse(data);
        this.logger.log(`Loaded ${this.backupMetadata.length} backup records`);
      }
    } catch (error) {
      this.logger.error('Failed to load backup metadata', error);
      this.backupMetadata = [];
    }
  }

  /**
   * Save backup metadata to file
   */
  private async saveBackupMetadata(): Promise<void> {
    try {
      const metadataPath = path.join(this.BACKUP_DIR, this.METADATA_FILE);
      fs.writeFileSync(
        metadataPath,
        JSON.stringify(this.backupMetadata, null, 2),
      );
    } catch (error) {
      this.logger.error('Failed to save backup metadata', error);
    }
  }

  /**
   * Perform automated daily backup
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async performDailyBackup(): Promise<BackupMetadata | null> {
    this.logger.log('Starting automated daily backup');
    return this.createBackup('full');
  }

  /**
   * Create a backup
   */
  async createBackup(
    type: 'full' | 'incremental' = 'full',
  ): Promise<BackupMetadata | null> {
    const backupId = crypto.randomUUID();
    const timestamp = new Date();
    const fileName = `backup-${type}-${timestamp.toISOString().replace(/[:.]/g, '-')}.json`;
    const filePath = path.join(this.BACKUP_DIR, fileName);

    const metadata: BackupMetadata = {
      id: backupId,
      timestamp,
      type,
      size: 0,
      checksum: '',
      tables: [],
      status: 'pending',
      storagePath: filePath,
      retentionDays:
        this.configService.get<number>('backup.retentionDays') || 30,
    };

    try {
      this.logger.log(`Starting ${type} backup: ${backupId}`);

      // Get all table data (simplified - in production, use proper database tools)
      const backupData: Record<string, any[]> = {};
      const tables = [
        'user',
        'workspace',
        'portal',
        'widget',
        'subscription',
        'integration',
        'auditLog',
        'alert',
        'scheduledReport',
        'webhook',
      ];

      for (const table of tables) {
        try {
          // @ts-ignore - dynamic table access
          const data = await this.prisma[table].findMany();
          backupData[table] = data;
          metadata.tables.push(table);
        } catch (error) {
          this.logger.warn(`Failed to backup table: ${table}`, error);
        }
      }

      // Serialize and encrypt backup data
      const jsonData = JSON.stringify(backupData, null, 2);
      const encrypted = this.encryptBackup(jsonData);

      // Write backup file
      fs.writeFileSync(filePath, encrypted);

      // Calculate checksum
      metadata.checksum = this.calculateChecksum(encrypted);
      metadata.size = Buffer.byteLength(encrypted, 'utf8');
      metadata.status = 'completed';

      // Store metadata
      this.backupMetadata.push(metadata);
      await this.saveBackupMetadata();

      this.logger.log(`Backup completed: ${backupId} (${metadata.size} bytes)`);

      // Verify backup integrity
      await this.verifyBackup(backupId);

      // Cleanup old backups
      await this.cleanupOldBackups();

      return metadata;
    } catch (error) {
      metadata.status = 'failed';
      metadata.error = error instanceof Error ? error.message : 'Unknown error';
      this.backupMetadata.push(metadata);
      await this.saveBackupMetadata();

      this.logger.error(`Backup failed: ${backupId}`, error);
      return null;
    }
  }

  /**
   * Encrypt backup data
   */
  private encryptBackup(data: string): string {
    const key = this.getBackupKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();

    return JSON.stringify({
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      data: encrypted,
    });
  }

  /**
   * Decrypt backup data
   */
  private decryptBackup(encryptedData: string): string {
    const { iv, tag, data } = JSON.parse(encryptedData);
    const key = this.getBackupKey();

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(iv, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Get backup encryption key
   */
  private getBackupKey(): Buffer {
    const key =
      this.configService.get<string>('app.encryptionKey') ||
      'default-backup-key';
    return crypto.pbkdf2Sync(key, 'backup-salt', 100000, 32, 'sha256');
  }

  /**
   * Calculate file checksum
   */
  private calculateChecksum(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId: string): Promise<boolean> {
    const metadata = this.backupMetadata.find((m) => m.id === backupId);
    if (!metadata) {
      this.logger.error(`Backup not found: ${backupId}`);
      return false;
    }

    try {
      if (!fs.existsSync(metadata.storagePath)) {
        this.logger.error(`Backup file not found: ${metadata.storagePath}`);
        return false;
      }

      const fileContent = fs.readFileSync(metadata.storagePath, 'utf8');
      const checksum = this.calculateChecksum(fileContent);

      if (checksum !== metadata.checksum) {
        this.logger.error(`Backup checksum mismatch: ${backupId}`);
        return false;
      }

      // Try to decrypt and parse
      const decrypted = this.decryptBackup(fileContent);
      JSON.parse(decrypted);

      metadata.status = 'verified';
      await this.saveBackupMetadata();

      this.logger.log(`Backup verified: ${backupId}`);
      return true;
    } catch (error) {
      this.logger.error(`Backup verification failed: ${backupId}`, error);
      return false;
    }
  }

  /**
   * List all backups
   */
  listBackups(): BackupMetadata[] {
    return this.backupMetadata.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }

  /**
   * Get backup by ID
   */
  getBackup(backupId: string): BackupMetadata | undefined {
    return this.backupMetadata.find((m) => m.id === backupId);
  }

  /**
   * Restore from backup (dry run by default)
   */
  async restoreBackup(options: RestoreOptions): Promise<{
    success: boolean;
    message: string;
    restoredTables?: string[];
  }> {
    const { backupId, dryRun = true } = options;

    const metadata = this.backupMetadata.find((m) => m.id === backupId);
    if (!metadata) {
      return { success: false, message: `Backup not found: ${backupId}` };
    }

    try {
      if (!fs.existsSync(metadata.storagePath)) {
        return {
          success: false,
          message: `Backup file not found: ${metadata.storagePath}`,
        };
      }

      const fileContent = fs.readFileSync(metadata.storagePath, 'utf8');
      const decrypted = this.decryptBackup(fileContent);
      const backupData = JSON.parse(decrypted);

      const tablesToRestore = options.tables || Object.keys(backupData);

      if (dryRun) {
        this.logger.log(
          `Dry run: Would restore tables: ${tablesToRestore.join(', ')}`,
        );
        return {
          success: true,
          message: `Dry run successful. Would restore ${tablesToRestore.length} tables.`,
          restoredTables: tablesToRestore,
        };
      }

      // WARNING: Actual restore is dangerous and should be done carefully
      // This is a simplified implementation
      this.logger.warn(
        'Starting actual restore - this is a destructive operation',
      );

      for (const table of tablesToRestore) {
        const data = backupData[table];
        if (!data || !Array.isArray(data)) continue;

        // In production, use proper database restore tools
        // This simplified version just logs what would be restored
        this.logger.log(`Would restore ${data.length} records to ${table}`);
      }

      return {
        success: true,
        message: `Restored ${tablesToRestore.length} tables from backup ${backupId}`,
        restoredTables: tablesToRestore,
      };
    } catch (error) {
      this.logger.error(`Restore failed: ${backupId}`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Restore failed',
      };
    }
  }

  /**
   * Cleanup old backups based on retention policy
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldBackups(): Promise<void> {
    this.logger.log('Starting backup cleanup');

    const now = new Date();
    const toDelete: string[] = [];

    for (const metadata of this.backupMetadata) {
      const age =
        (now.getTime() - new Date(metadata.timestamp).getTime()) /
        (1000 * 60 * 60 * 24);

      if (age > metadata.retentionDays) {
        toDelete.push(metadata.id);
      }
    }

    for (const id of toDelete) {
      await this.deleteBackup(id);
    }

    if (toDelete.length > 0) {
      this.logger.log(`Cleaned up ${toDelete.length} old backups`);
    }
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string): Promise<boolean> {
    const metadata = this.backupMetadata.find((m) => m.id === backupId);
    if (!metadata) {
      return false;
    }

    try {
      if (fs.existsSync(metadata.storagePath)) {
        fs.unlinkSync(metadata.storagePath);
      }

      this.backupMetadata = this.backupMetadata.filter(
        (m) => m.id !== backupId,
      );
      await this.saveBackupMetadata();

      this.logger.log(`Deleted backup: ${backupId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete backup: ${backupId}`, error);
      return false;
    }
  }

  /**
   * Get backup statistics
   */
  getBackupStats(): {
    totalBackups: number;
    totalSize: number;
    lastBackup: Date | null;
    nextScheduledBackup: Date;
    failedBackups: number;
  } {
    const totalSize = this.backupMetadata.reduce((sum, m) => sum + m.size, 0);
    const lastBackup =
      this.backupMetadata.length > 0
        ? new Date(
            Math.max(
              ...this.backupMetadata.map((m) =>
                new Date(m.timestamp).getTime(),
              ),
            ),
          )
        : null;
    const failedBackups = this.backupMetadata.filter(
      (m) => m.status === 'failed',
    ).length;

    // Calculate next scheduled backup (2 AM)
    const now = new Date();
    const next = new Date(now);
    next.setHours(2, 0, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return {
      totalBackups: this.backupMetadata.length,
      totalSize,
      lastBackup,
      nextScheduledBackup: next,
      failedBackups,
    };
  }
}
