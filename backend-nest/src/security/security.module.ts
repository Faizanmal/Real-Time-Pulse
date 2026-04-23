import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuditModule } from '../audit/audit.module';
import { CacheModule } from '../cache/cache.module';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';

import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';
import { SsoService } from './sso.service';
import { TwoFactorService } from './two-factor.service';

@Module({
  imports: [ConfigModule, PrismaModule, CacheModule, AuditModule, EmailModule],
  controllers: [SecurityController],
  providers: [SecurityService, SsoService, TwoFactorService],
  exports: [SecurityService, SsoService, TwoFactorService],
})
export class SecurityModule {}
