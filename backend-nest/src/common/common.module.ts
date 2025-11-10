import { Module, Global } from '@nestjs/common';
import { EncryptionService } from './services/encryption.service';
import { S3Service } from './services/s3.service';
import { LoggingService } from './logger/logging.service';

@Global()
@Module({
  providers: [EncryptionService, S3Service, LoggingService],
  exports: [EncryptionService, S3Service, LoggingService],
})
export class CommonModule {}
