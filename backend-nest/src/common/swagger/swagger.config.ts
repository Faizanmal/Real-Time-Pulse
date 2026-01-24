import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Portal API')
    .setDescription(
      'Multi-tenant B2B SaaS platform for creating real-time client dashboards. ' +
        'This API enables agencies and freelancers to create branded dashboards that ' +
        'automatically pull data from tools like Asana, Google Analytics, and Harvest.',
    )
    .setVersion('1.0')
    .setContact('Portal Support', 'https://portal.example.com', 'support@portal.example.com')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
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
    .addTag('Authentication', 'User authentication and authorization endpoints')
    .addTag('Workspaces', 'Workspace (tenant) management endpoints')
    .addTag('Portals', 'Portal (dashboard) CRUD operations')
    .addTag('Widgets', 'Widget management and configuration')
    .addTag('Integrations', 'Third-party service integrations')
    .addTag('Health', 'System health and monitoring endpoints')
    .addServer('http://localhost:3000', 'Local development')
    .addServer('https://api.portal.example.com', 'Production')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Portal API Documentation',
    customfavIcon: 'https://portal.example.com/favicon.ico',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { font-size: 36px; }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
      syntaxHighlight: {
        activate: true,
        theme: 'monokai',
      },
    },
  });
}
