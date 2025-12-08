import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { LoggingService } from './common/logger/logging.service';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const logger = await app.resolve(LoggingService);
  app.useLogger(logger);

  // ==================== SECURITY HEADERS ====================
  app.use(
    helmet({
      // Content Security Policy
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          scriptSrc: ["'self'"],
          connectSrc: [
            "'self'",
            'https://www.google.com',
            'https://www.gstatic.com',
          ],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      // Strict Transport Security (HSTS)
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      // Prevent clickjacking
      frameguard: { action: 'deny' },
      // Prevent MIME type sniffing
      noSniff: true,
      // XSS filter
      xssFilter: true,
      // Referrer Policy
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      // Don't expose powered by
      hidePoweredBy: true,
      // DNS Prefetch Control
      dnsPrefetchControl: { allow: false },
      // IE No Open
      ieNoOpen: true,
    }),
  );

  // Cookie parser for secure cookies
  app.use(cookieParser());

  // ==================== CORS CONFIGURATION ====================
  const allowedOrigins = configService
    .get<string>('app.frontendUrl')
    ?.split(',') || ['http://localhost:3001'];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`Blocked CORS request from: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token',
      'X-API-Key',
    ],
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
    maxAge: 86400, // 24 hours
  });

  // ==================== VALIDATION ====================
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip non-whitelisted properties
      forbidNonWhitelisted: true, // Throw error for non-whitelisted properties
      transform: true, // Auto-transform payloads to DTO types
      transformOptions: {
        enableImplicitConversion: true,
      },
      // Detailed validation errors in development only
      disableErrorMessages: configService.get('app.nodeEnv') === 'production',
      validationError: {
        target: false, // Don't expose the target object in errors
        value: false, // Don't expose the value in errors
      },
    }),
  );

  // Global response interceptor
  app.useGlobalInterceptors(new ResponseInterceptor());

  // ==================== API VERSIONING ====================
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // ==================== SWAGGER DOCUMENTATION ====================
  if (configService.get('app.nodeEnv') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Real-Time Pulse API')
      .setDescription(
        'Enterprise-grade API for Real-Time Portal Management System with integrated analytics, widgets, and workspace collaboration.',
      )
      .setVersion('1.0')
      .addTag('Auth', 'Authentication and authorization endpoints')
      .addTag('Workspaces', 'Workspace management')
      .addTag('Portals', 'Portal CRUD operations')
      .addTag('Widgets', 'Widget management and data')
      .addTag('Health', 'Health checks and system status')
      .addTag('Audit', 'Audit logs and compliance')
      .addTag('Security', 'Security management')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addApiKey(
        {
          type: 'apiKey',
          name: 'X-API-Key',
          in: 'header',
          description: 'API Key for programmatic access',
        },
        'API-Key',
      )
      .addServer('http://localhost:3000', 'Local Development')
      .addServer('https://api.staging.realtimepulse.com', 'Staging')
      .addServer('https://api.realtimepulse.com', 'Production')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
        docExpansion: 'none',
      },
      customSiteTitle: 'Real-Time Pulse API Documentation',
    });
  }

  // ==================== GRACEFUL SHUTDOWN ====================
  app.enableShutdownHooks();

  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port);

  logger.log(`🚀 Real-Time Pulse API running on http://localhost:${port}/api`);
  logger.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
  logger.log(`🏥 Health Check: http://localhost:${port}/api/health`);
  logger.log(`🔒 Security: Enhanced security headers enabled`);
}
void bootstrap();
