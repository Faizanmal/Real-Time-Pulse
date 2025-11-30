import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';
import { AuditModule } from '../audit/audit.module';
import { EmailModule } from '../email/email.module';
import { SecurityService } from './security.service';
import { SsoService } from './sso.service';
import { TwoFactorService } from './two-factor.service';
import { SecurityController } from './security.controller';

@Module({
  imports: [ConfigModule, PrismaModule, CacheModule, AuditModule, EmailModule],
  controllers: [SecurityController],
  providers: [SecurityService, SsoService, TwoFactorService],
  exports: [SecurityService, SsoService, TwoFactorService],
})
export class SecurityModule {}
