/**
 * ============================================================================
 * REAL-TIME PULSE - ULTRA-MAX GRAPHQL CONFIGURATION
 * ============================================================================
 * Enterprise-grade GraphQL configuration with subscriptions, federation,
 * caching, and advanced security features.
 */

import { registerAs } from '@nestjs/config';

export default registerAs('graphql', () => ({
  // GraphQL Playground & Introspection
  playground: process.env.NODE_ENV !== 'production',
  introspection: process.env.NODE_ENV !== 'production',
  
  // Schema Configuration
  autoSchemaFile: 'schema.gql',
  sortSchema: true,
  
  // Subscriptions (WebSocket)
  subscriptions: {
    'graphql-ws': {
      path: '/graphql',
      onConnect: (context: any) => {
        // Authentication for subscriptions
        const { connectionParams } = context;
        if (connectionParams?.authorization) {
          return { authorization: connectionParams.authorization };
        }
        return {};
      },
    },
    'subscriptions-transport-ws': false, // Deprecated, use graphql-ws
  },
  
  // Federation Configuration (for microservices)
  federation: {
    enabled: process.env.GRAPHQL_FEDERATION_ENABLED === 'true',
    gateway: process.env.GRAPHQL_IS_GATEWAY === 'true',
    services: process.env.GRAPHQL_FEDERATION_SERVICES?.split(',') || [],
  },
  
  // Query Complexity & Depth Limiting
  complexity: {
    enabled: true,
    maxComplexity: parseInt(process.env.GRAPHQL_MAX_COMPLEXITY || '1000', 10),
    maxDepth: parseInt(process.env.GRAPHQL_MAX_DEPTH || '10', 10),
  },
  
  // Caching Configuration
  cache: {
    enabled: true,
    ttl: parseInt(process.env.GRAPHQL_CACHE_TTL || '60', 10), // seconds
    maxSize: parseInt(process.env.GRAPHQL_CACHE_MAX_SIZE || '1000', 10),
  },
  
  // Persisted Queries
  persistedQueries: {
    enabled: process.env.GRAPHQL_PERSISTED_QUERIES === 'true',
    cache: 'redis', // 'memory' | 'redis'
  },
  
  // Upload Configuration
  uploads: {
    maxFileSize: parseInt(process.env.GRAPHQL_MAX_FILE_SIZE || '10485760', 10), // 10MB
    maxFiles: parseInt(process.env.GRAPHQL_MAX_FILES || '10', 10),
  },
  
  // Tracing & Debugging
  tracing: process.env.NODE_ENV !== 'production',
  debug: process.env.NODE_ENV !== 'production',
  
  // Context Configuration
  context: ({ req, res, connection }: any) => {
    if (connection) {
      // Subscription context
      return { req: connection.context, res };
    }
    return { req, res };
  },
  
  // Error Formatting
  formatError: (error: any) => {
    // Remove stack traces in production
    if (process.env.NODE_ENV === 'production') {
      delete error.extensions?.exception?.stacktrace;
    }
    return error;
  },
  
  // Schema Directives
  directives: {
    deprecated: true,
    specifiedBy: true,
    custom: ['auth', 'permission', 'rateLimit', 'cache', 'validate'],
  },
}));
