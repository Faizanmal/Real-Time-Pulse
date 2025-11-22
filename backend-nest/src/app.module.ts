import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { WorkspaceModule } from './workspaces/workspace.module';
import { PortalModule } from './portals/portal.module';
import { WidgetModule } from './widgets/widget.module';
import { CacheModule } from './cache/cache.module';
import { HealthModule } from './health/health.module';
import { EmailModule } from './email/email.module';
import { AuditModule } from './audit/audit.module';
import { JobsModule } from './jobs/jobs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { IntegrationModule } from './integrations/integration.module';
import { ExportModule } from './exports/export.module';
import { AIInsightsModule } from './ai-insights/ai-insights.module';
import { AlertsModule } from './alerts/alerts.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { HttpLoggerMiddleware } from './common/middleware/http-logger.middleware';

// Config imports
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import oauthConfig from './config/oauth.config';
import s3Config from './config/s3.config';
import throttleConfig from './config/throttle.config';
import emailConfig from './config/email.config';
import loggerConfig from './config/logger.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        jwtConfig,
        redisConfig,
        oauthConfig,
        s3Config,
        throttleConfig,
        emailConfig,
        loggerConfig,
      ],
    }),
    // Rate limiting
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60000, // 1 minute
            limit: 100,
          },
        ],
      }),
    }),
    PrismaModule,
    CommonModule,
    CacheModule,
    HealthModule,
    EmailModule,
    AuditModule,
    JobsModule,
    NotificationsModule,
    IntegrationModule,
    AuthModule,
    WorkspaceModule,
    PortalModule,
    WidgetModule,
    ExportModule,
    AIInsightsModule,
    AlertsModule,
    WebhooksModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestContextMiddleware, HttpLoggerMiddleware)
      .forRoutes('*');
  }
}
