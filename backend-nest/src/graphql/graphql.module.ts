/**
 * ============================================================================
 * REAL-TIME PULSE - ULTRA-MAX GRAPHQL MODULE
 * ============================================================================
 * Enterprise-grade GraphQL implementation with subscriptions, federation,
 * and advanced security features.
 */

import { Module } from '@nestjs/common';
import { GraphQLModule as NestGraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { GraphQLService } from './graphql.service';
import { PortalResolver } from './resolvers/portal.resolver';
import { WidgetResolver } from './resolvers/widget.resolver';
import { WorkspaceResolver } from './resolvers/workspace.resolver';
import { UserResolver } from './resolvers/user.resolver';
import { IntegrationResolver } from './resolvers/integration.resolver';
import { AnalyticsResolver } from './resolvers/analytics.resolver';
import { AlertResolver } from './resolvers/alert.resolver';
import { AIInsightResolver } from './resolvers/ai-insight.resolver';
import { ComplexityPlugin } from './plugins/complexity.plugin';
import { LoggingPlugin } from './plugins/logging.plugin';
import { CacheControlPlugin } from './plugins/cache-control.plugin';
import { DataLoaderService } from './dataloader.service';

@Module({
  imports: [
    NestGraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      useFactory: async (configService: ConfigService) => ({
        autoSchemaFile: join(process.cwd(), 'schema.gql'),
        sortSchema: true,
        playground: configService.get('graphql.playground'),
        introspection: configService.get('graphql.introspection'),
        
        // Subscriptions via graphql-ws
        subscriptions: {
          'graphql-ws': {
            path: '/graphql/ws',
            onConnect: (context: any) => {
              const { connectionParams, extra } = context;
              // Authenticate subscription connections
              if (connectionParams?.authorization) {
                return { authorization: connectionParams.authorization };
              }
              return {};
            },
          },
        },
        
        // Context for each request
        context: ({ req, res, connection }) => {
          if (connection) {
            return { ...connection.context };
          }
          return {
            req,
            res,
            // Data loaders will be injected per request
          };
        },
        
        // Error formatting
        formatError: (error) => {
          // Remove stack traces in production
          if (process.env.NODE_ENV === 'production') {
            delete error.extensions?.exception?.stacktrace;
          }
          return {
            message: error.message,
            locations: error.locations,
            path: error.path,
            extensions: {
              code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
              ...(process.env.NODE_ENV !== 'production' && error.extensions),
            },
          };
        },
        
        // Plugins
        plugins: [],
        
        // Cache configuration
        cache: 'bounded',
        persistedQueries: {
          ttl: 900, // 15 minutes
        },
        
        // Upload configuration
        uploads: false, // Handled separately
        
        // CORS handled by main app
        cors: false,
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    GraphQLService,
    DataLoaderService,
    // Resolvers
    PortalResolver,
    WidgetResolver,
    WorkspaceResolver,
    UserResolver,
    IntegrationResolver,
    AnalyticsResolver,
    AlertResolver,
    AIInsightResolver,
    // Plugins
    ComplexityPlugin,
    LoggingPlugin,
    CacheControlPlugin,
  ],
  exports: [GraphQLService, DataLoaderService],
})
export class GraphQLAppModule {}
