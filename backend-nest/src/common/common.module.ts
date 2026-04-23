import { HttpModule } from '@nestjs/axios';
import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuditModule } from '../audit/audit.module';
import { CacheModule } from '../cache/cache.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';

import { LoggingService } from './logger/logging.service';
import { AdvancedSearchService } from './services/advanced-search.service';
import { BackupService } from './services/backup.service';
import { BulkOperationsService } from './services/bulk-operations.service';
import { DataProtectionService } from './services/data-protection.service';
import { EncryptionService } from './services/encryption.service';
import { QueryCacheService } from './services/query-cache.service';
import { RateLimitService } from './services/rate-limit.service';
import { RecaptchaService } from './services/recaptcha.service';
import { S3Service } from './services/s3.service';

@Global()
@Module({
  imports: [HttpModule, ConfigModule, CacheModule, AuditModule, PrismaModule, NotificationsModule],
  providers: [
    EncryptionService,
    S3Service,
    LoggingService,
    RecaptchaService,
    RateLimitService,
    DataProtectionService,
    BackupService,
    AdvancedSearchService,
    BulkOperationsService,
    QueryCacheService,
  ],
  exports: [
    EncryptionService,
    S3Service,
    LoggingService,
    RecaptchaService,
    RateLimitService,
    DataProtectionService,
    BackupService,
    AdvancedSearchService,
    BulkOperationsService,
    QueryCacheService,
  ],
})
export class CommonModule {}
