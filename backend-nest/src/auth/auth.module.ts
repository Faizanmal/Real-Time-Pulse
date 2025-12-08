import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { GitHubStrategy } from './strategies/github.strategy';
import { FirebaseAuthService } from './services/firebase-auth.service';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        return {
          secret: configService.get<string>('jwt.secret') as string,
          signOptions: {
            expiresIn:
              (configService.get<string>('jwt.expiresIn') as string) || '15m',
            issuer: 'real-time-pulse',
            audience: 'real-time-pulse-api',
          },
        } as JwtModuleOptions;
      },
      inject: [ConfigService],
    }),
    HttpModule,
    CommonModule,
    PrismaModule,
    CacheModule,
    AuditModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    GitHubStrategy,
    FirebaseAuthService,
  ],
  exports: [AuthService, FirebaseAuthService],
})
export class AuthModule {}
