/**
 * ============================================================================
 * REAL-TIME PULSE - ULTRA-MAX OBSERVABILITY CONFIGURATION
 * ============================================================================
 * Comprehensive observability setup including distributed tracing,
 * metrics collection, logging aggregation, and APM integration.
 */

import { registerAs } from '@nestjs/config';

export default registerAs('observability', () => ({
  // OpenTelemetry Configuration
  opentelemetry: {
    enabled: process.env.OTEL_ENABLED === 'true',
    serviceName: process.env.OTEL_SERVICE_NAME || 'real-time-pulse',
    serviceVersion: process.env.npm_package_version || '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    
    // Tracing
    tracing: {
      enabled: true,
      exporter: process.env.OTEL_TRACES_EXPORTER || 'jaeger', // jaeger | zipkin | otlp
      endpoint: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:14268/api/traces',
      samplingRatio: parseFloat(process.env.OTEL_SAMPLING_RATIO || '1.0'),
      propagators: ['tracecontext', 'baggage', 'b3'],
    },
    
    // Metrics
    metrics: {
      enabled: true,
      exporter: process.env.OTEL_METRICS_EXPORTER || 'prometheus', // prometheus | otlp
      endpoint: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || 'http://localhost:4318/v1/metrics',
      exportIntervalMillis: parseInt(process.env.OTEL_METRICS_EXPORT_INTERVAL || '60000', 10),
    },
    
    // Logs
    logs: {
      enabled: true,
      exporter: process.env.OTEL_LOGS_EXPORTER || 'otlp',
      endpoint: process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT || 'http://localhost:4318/v1/logs',
    },
    
    // Resource Attributes
    resourceAttributes: {
      'deployment.environment': process.env.NODE_ENV,
      'service.namespace': 'real-time-pulse',
      'host.name': process.env.HOSTNAME,
      'cloud.provider': process.env.CLOUD_PROVIDER,
      'cloud.region': process.env.CLOUD_REGION,
    },
  },

  // Prometheus Metrics
  prometheus: {
    enabled: process.env.PROMETHEUS_ENABLED !== 'false',
    path: '/metrics',
    defaultMetrics: true,
    defaultLabels: {
      app: 'real-time-pulse',
      env: process.env.NODE_ENV,
    },
    customMetrics: {
      // HTTP Metrics
      httpRequestDuration: {
        name: 'http_request_duration_seconds',
        help: 'Duration of HTTP requests in seconds',
        labelNames: ['method', 'route', 'status_code'],
        buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      },
      httpRequestTotal: {
        name: 'http_requests_total',
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'route', 'status_code'],
      },
      
      // Business Metrics
      activePortals: {
        name: 'pulse_active_portals_total',
        help: 'Total number of active portals',
        labelNames: ['workspace'],
      },
      widgetRefreshes: {
        name: 'pulse_widget_refreshes_total',
        help: 'Total number of widget data refreshes',
        labelNames: ['type', 'integration'],
      },
      integrationSyncs: {
        name: 'pulse_integration_syncs_total',
        help: 'Total number of integration data syncs',
        labelNames: ['provider', 'status'],
      },
      aiInsightsGenerated: {
        name: 'pulse_ai_insights_generated_total',
        help: 'Total number of AI insights generated',
        labelNames: ['type', 'severity'],
      },
      reportsGenerated: {
        name: 'pulse_reports_generated_total',
        help: 'Total number of reports generated',
        labelNames: ['format', 'type'],
      },
      webhookDeliveries: {
        name: 'pulse_webhook_deliveries_total',
        help: 'Total number of webhook deliveries',
        labelNames: ['status', 'event'],
      },
      
      // WebSocket Metrics
      wsConnections: {
        name: 'pulse_websocket_connections',
        help: 'Current number of WebSocket connections',
        labelNames: ['namespace'],
      },
      wsMessages: {
        name: 'pulse_websocket_messages_total',
        help: 'Total number of WebSocket messages',
        labelNames: ['namespace', 'event', 'direction'],
      },
      
      // Queue Metrics
      queueJobsProcessed: {
        name: 'pulse_queue_jobs_processed_total',
        help: 'Total number of queue jobs processed',
        labelNames: ['queue', 'status'],
      },
      queueJobDuration: {
        name: 'pulse_queue_job_duration_seconds',
        help: 'Duration of queue job processing',
        labelNames: ['queue', 'job_type'],
        buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120],
      },
    },
  },

  // Distributed Tracing (Jaeger)
  jaeger: {
    enabled: process.env.JAEGER_ENABLED === 'true',
    agentHost: process.env.JAEGER_AGENT_HOST || 'localhost',
    agentPort: parseInt(process.env.JAEGER_AGENT_PORT || '6832', 10),
    collectorEndpoint: process.env.JAEGER_COLLECTOR_ENDPOINT || 'http://localhost:14268/api/traces',
    samplerType: process.env.JAEGER_SAMPLER_TYPE || 'probabilistic',
    samplerParam: parseFloat(process.env.JAEGER_SAMPLER_PARAM || '1.0'),
    logSpans: process.env.NODE_ENV !== 'production',
  },

  // APM Integration (New Relic / DataDog / Dynatrace)
  apm: {
    provider: process.env.APM_PROVIDER, // newrelic | datadog | dynatrace | elastic
    
    newrelic: {
      enabled: process.env.NEW_RELIC_ENABLED === 'true',
      licenseKey: process.env.NEW_RELIC_LICENSE_KEY,
      appName: process.env.NEW_RELIC_APP_NAME || 'Real-Time-Pulse',
      distributedTracing: true,
      logging: {
        enabled: true,
        level: 'info',
      },
    },
    
    datadog: {
      enabled: process.env.DD_ENABLED === 'true',
      apiKey: process.env.DD_API_KEY,
      appKey: process.env.DD_APP_KEY,
      site: process.env.DD_SITE || 'datadoghq.com',
      service: 'real-time-pulse',
      env: process.env.NODE_ENV,
      version: process.env.npm_package_version,
      profiling: process.env.DD_PROFILING_ENABLED === 'true',
      runtimeMetrics: true,
    },
    
    dynatrace: {
      enabled: process.env.DT_ENABLED === 'true',
      apiToken: process.env.DT_API_TOKEN,
      environmentUrl: process.env.DT_ENVIRONMENT_URL,
      applicationId: process.env.DT_APPLICATION_ID,
    },
    
    elastic: {
      enabled: process.env.ELASTIC_APM_ENABLED === 'true',
      serverUrl: process.env.ELASTIC_APM_SERVER_URL || 'http://localhost:8200',
      secretToken: process.env.ELASTIC_APM_SECRET_TOKEN,
      serviceName: 'real-time-pulse',
      environment: process.env.NODE_ENV,
      captureBody: 'all',
      captureHeaders: true,
    },
  },

  // Error Tracking (Sentry)
  sentry: {
    enabled: process.env.SENTRY_ENABLED === 'true',
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    release: process.env.npm_package_version,
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '1.0'),
    profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '1.0'),
    attachStacktrace: true,
    integrations: ['http', 'express', 'prisma', 'redis'],
    beforeSend: (event: any) => {
      // Scrub sensitive data
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },
  },

  // Log Aggregation (ELK / Loki)
  logAggregation: {
    provider: process.env.LOG_AGGREGATION_PROVIDER || 'loki', // elasticsearch | loki
    
    elasticsearch: {
      enabled: process.env.ELASTICSEARCH_ENABLED === 'true',
      nodes: (process.env.ELASTICSEARCH_NODES || 'http://localhost:9200').split(','),
      index: process.env.ELASTICSEARCH_INDEX || 'pulse-logs',
      auth: {
        username: process.env.ELASTICSEARCH_USERNAME,
        password: process.env.ELASTICSEARCH_PASSWORD,
        apiKey: process.env.ELASTICSEARCH_API_KEY,
      },
    },
    
    loki: {
      enabled: process.env.LOKI_ENABLED === 'true',
      host: process.env.LOKI_HOST || 'http://localhost:3100',
      labels: {
        app: 'real-time-pulse',
        env: process.env.NODE_ENV,
      },
      batching: true,
      batchInterval: 5, // seconds
    },
  },

  // Health Checks
  healthChecks: {
    path: '/health',
    liveness: '/health/live',
    readiness: '/health/ready',
    checks: {
      database: true,
      redis: true,
      memory: {
        heapUsedThreshold: 0.9, // 90%
      },
      disk: {
        thresholdPercent: 0.9, // 90%
        path: '/',
      },
      custom: ['integrations', 'queues', 'websocket'],
    },
  },

  // Alerting
  alerting: {
    enabled: process.env.ALERTING_ENABLED === 'true',
    provider: process.env.ALERTING_PROVIDER || 'pagerduty', // pagerduty | opsgenie | victorops
    
    pagerduty: {
      serviceKey: process.env.PAGERDUTY_SERVICE_KEY,
      integrationKey: process.env.PAGERDUTY_INTEGRATION_KEY,
    },
    
    opsgenie: {
      apiKey: process.env.OPSGENIE_API_KEY,
      region: process.env.OPSGENIE_REGION || 'us',
    },
    
    slack: {
      webhookUrl: process.env.SLACK_ALERTS_WEBHOOK_URL,
      channel: process.env.SLACK_ALERTS_CHANNEL || '#alerts',
    },
    
    rules: {
      errorRate: {
        threshold: 5, // errors per minute
        severity: 'high',
      },
      responseTime: {
        threshold: 2000, // ms
        severity: 'medium',
      },
      memoryUsage: {
        threshold: 90, // percent
        severity: 'high',
      },
    },
  },
}));
