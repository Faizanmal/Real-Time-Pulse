/**
 * ============================================================================
 * REAL-TIME PULSE - ULTRA-MAX MICROSERVICES CONFIGURATION
 * ============================================================================
 * Enterprise-grade microservices configuration supporting multiple transport
 * layers including gRPC, NATS, RabbitMQ, Kafka, and Redis.
 */

import { registerAs } from '@nestjs/config';

export default registerAs('microservices', () => ({
  // Service Discovery
  discovery: {
    enabled: process.env.SERVICE_DISCOVERY_ENABLED === 'true',
    provider: process.env.SERVICE_DISCOVERY_PROVIDER || 'consul', // consul | kubernetes | etcd
    host: process.env.SERVICE_DISCOVERY_HOST || 'localhost',
    port: parseInt(process.env.SERVICE_DISCOVERY_PORT || '8500', 10),
  },

  // gRPC Configuration
  grpc: {
    enabled: process.env.GRPC_ENABLED === 'true',
    host: process.env.GRPC_HOST || '0.0.0.0',
    port: parseInt(process.env.GRPC_PORT || '5000', 10),
    package: 'realtimepulse',
    protoPath: ['./proto/pulse.proto', './proto/analytics.proto', './proto/notifications.proto'],
    loader: {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    },
    credentials: {
      insecure: process.env.NODE_ENV !== 'production',
      rootCerts: process.env.GRPC_ROOT_CERTS,
      privateKey: process.env.GRPC_PRIVATE_KEY,
      certChain: process.env.GRPC_CERT_CHAIN,
    },
    maxReceiveMessageLength: 1024 * 1024 * 50, // 50MB
    maxSendMessageLength: 1024 * 1024 * 50, // 50MB
  },

  // NATS Configuration (for event streaming)
  nats: {
    enabled: process.env.NATS_ENABLED === 'true',
    servers: (process.env.NATS_SERVERS || 'nats://localhost:4222').split(','),
    queue: process.env.NATS_QUEUE || 'pulse-queue',
    user: process.env.NATS_USER,
    pass: process.env.NATS_PASS,
    token: process.env.NATS_TOKEN,
    maxReconnectAttempts: parseInt(process.env.NATS_MAX_RECONNECT || '10', 10),
    reconnectTimeWait: parseInt(process.env.NATS_RECONNECT_WAIT || '1000', 10),
    jetstream: {
      enabled: process.env.NATS_JETSTREAM_ENABLED === 'true',
      domain: process.env.NATS_JETSTREAM_DOMAIN,
    },
  },

  // RabbitMQ Configuration
  rabbitmq: {
    enabled: process.env.RABBITMQ_ENABLED === 'true',
    urls: (process.env.RABBITMQ_URLS || 'amqp://localhost:5672').split(','),
    queue: process.env.RABBITMQ_QUEUE || 'pulse-main',
    queueOptions: {
      durable: true,
      exclusive: false,
      autoDelete: false,
    },
    exchanges: {
      events: {
        name: 'pulse.events',
        type: 'topic',
        options: { durable: true },
      },
      commands: {
        name: 'pulse.commands',
        type: 'direct',
        options: { durable: true },
      },
      notifications: {
        name: 'pulse.notifications',
        type: 'fanout',
        options: { durable: true },
      },
    },
    prefetchCount: parseInt(process.env.RABBITMQ_PREFETCH || '10', 10),
    heartbeat: parseInt(process.env.RABBITMQ_HEARTBEAT || '60', 10),
  },

  // Kafka Configuration (for high-throughput streaming)
  kafka: {
    enabled: process.env.KAFKA_ENABLED === 'true',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'pulse-client',
    groupId: process.env.KAFKA_GROUP_ID || 'pulse-group',
    ssl: process.env.KAFKA_SSL === 'true',
    sasl:
      process.env.KAFKA_SASL_ENABLED === 'true'
        ? {
            mechanism: process.env.KAFKA_SASL_MECHANISM || 'plain',
            username: process.env.KAFKA_SASL_USERNAME,
            password: process.env.KAFKA_SASL_PASSWORD,
          }
        : undefined,
    topics: {
      events: 'pulse.events',
      analytics: 'pulse.analytics',
      notifications: 'pulse.notifications',
      audit: 'pulse.audit',
      deadLetter: 'pulse.dead-letter',
    },
    consumer: {
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      maxBytesPerPartition: 1048576, // 1MB
    },
    producer: {
      acks: -1, // All replicas must acknowledge
      idempotent: true,
      transactionalId: 'pulse-producer',
    },
  },

  // Redis Streams Configuration
  redis: {
    enabled: process.env.REDIS_STREAMS_ENABLED === 'true',
    streams: {
      events: 'pulse:events',
      notifications: 'pulse:notifications',
      tasks: 'pulse:tasks',
    },
    consumer: {
      group: process.env.REDIS_CONSUMER_GROUP || 'pulse-consumers',
      consumer: process.env.REDIS_CONSUMER_NAME || `pulse-consumer-${process.pid}`,
      block: 5000,
      count: 10,
    },
  },

  // Service Mesh Configuration
  mesh: {
    enabled: process.env.SERVICE_MESH_ENABLED === 'true',
    provider: process.env.SERVICE_MESH_PROVIDER || 'istio', // istio | linkerd | consul-connect
    mtls: process.env.SERVICE_MESH_MTLS === 'true',
    tracing: {
      enabled: true,
      endpoint: process.env.SERVICE_MESH_TRACING_ENDPOINT,
    },
  },

  // Circuit Breaker Configuration
  circuitBreaker: {
    enabled: true,
    timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '10000', 10),
    errorThresholdPercentage: parseInt(process.env.CIRCUIT_BREAKER_ERROR_THRESHOLD || '50', 10),
    resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '30000', 10),
    volumeThreshold: parseInt(process.env.CIRCUIT_BREAKER_VOLUME_THRESHOLD || '10', 10),
  },

  // Retry Configuration
  retry: {
    maxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS || '3', 10),
    delay: parseInt(process.env.RETRY_DELAY || '1000', 10),
    maxDelay: parseInt(process.env.RETRY_MAX_DELAY || '30000', 10),
    exponentialBackoff: true,
    jitter: true,
  },

  // Load Balancing
  loadBalancing: {
    strategy: process.env.LOAD_BALANCING_STRATEGY || 'round-robin', // round-robin | random | least-connections | weighted
    healthCheck: {
      enabled: true,
      interval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10),
      timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000', 10),
    },
  },
}));
