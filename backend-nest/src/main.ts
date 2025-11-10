import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { LoggingService } from './common/logger/logging.service';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const logger = app.get(LoggingService);
  app.useLogger(logger);

  // Security
  app.use(helmet());

  // CORS
  app.enableCors({
    origin: configService.get<string>('app.frontendUrl'),
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global response interceptor
  app.useGlobalInterceptors(new ResponseInterceptor());

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Swagger API Documentation
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
    },
    customSiteTitle: 'Real-Time Pulse API Documentation',
  });

  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port);

  logger.log(`🚀 Real-Time Pulse API running on http://localhost:${port}/api`);
  logger.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
  logger.log(`🏥 Health Check: http://localhost:${port}/api/health`);
}
void bootstrap();
