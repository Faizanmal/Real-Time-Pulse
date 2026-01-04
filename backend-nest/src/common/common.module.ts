import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { EncryptionService } from './services/encryption.service';
import { S3Service } from './services/s3.service';
import { LoggingService } from './logger/logging.service';
import { RecaptchaService } from './services/recaptcha.service';
import { RateLimitService } from './services/rate-limit.service';
import { DataProtectionService } from './services/data-protection.service';
import { BackupService } from './services/backup.service';
import { AdvancedSearchService } from './services/advanced-search.service';
import { BulkOperationsService } from './services/bulk-operations.service';
import { CacheModule } from '../cache/cache.module';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';

import { NotificationsModule } from '../notifications/notifications.module';

@Global()
@Module({
  imports: [
    HttpModule,
    ConfigModule,
    CacheModule,
    AuditModule,
    PrismaModule,
    NotificationsModule,
  ],
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
  ],
})
export class CommonModule {}
