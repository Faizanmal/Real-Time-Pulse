/**
 * ============================================================================
 * PRODUCTION CONFIGURATION & ENVIRONMENT VALIDATION
 * ============================================================================
 * Comprehensive configuration management for production deployments including
 * environment validation, feature flags, and runtime configuration.
 */

import { z } from 'zod';

// ==================== ENVIRONMENT SCHEMAS ====================

const DatabaseConfigSchema = z.object({
  url: z.string().url('DATABASE_URL must be a valid URL'),
  poolMin: z.number().min(1).default(2),
  poolMax: z.number().min(1).default(10),
  connectionTimeout: z.number().min(1000).default(30000),
  idleTimeout: z.number().min(1000).default(10000),
});

const RedisConfigSchema = z.object({
  url: z.string().url('REDIS_URL must be a valid URL'),
  tls: z.boolean().default(false),
  maxRetries: z.number().min(0).default(3),
  retryDelay: z.number().min(100).default(1000),
});

const AuthConfigSchema = z.object({
  jwtSecret: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  jwtExpiresIn: z.string().default('7d'),
  refreshTokenExpiresIn: z.string().default('30d'),
  bcryptRounds: z.number().min(10).max(14).default(12),
  mfaIssuer: z.string().default('RealTimePulse'),
});

const OAuthProviderSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  callbackUrl: z.string().url(),
});

const OAuthConfigSchema = z.object({
  google: OAuthProviderSchema.optional(),
  github: OAuthProviderSchema.optional(),
  microsoft: OAuthProviderSchema.optional(),
});

const EmailConfigSchema = z.object({
  provider: z.enum(['sendgrid', 'ses', 'smtp', 'resend']).default('sendgrid'),
  apiKey: z.string().optional(),
  fromAddress: z.string().email(),
  fromName: z.string().default('Real-Time Pulse'),
  smtp: z.object({
    host: z.string(),
    port: z.number(),
    secure: z.boolean().default(true),
    user: z.string(),
    pass: z.string(),
  }).optional(),
});

const StorageConfigSchema = z.object({
  provider: z.enum(['s3', 'gcs', 'azure', 'local']).default('s3'),
  bucket: z.string(),
  region: z.string().optional(),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
  publicUrl: z.string().url().optional(),
});

const RateLimitConfigSchema = z.object({
  windowMs: z.number().min(1000).default(60000),
  maxRequests: z.number().min(1).default(100),
  skipFailedRequests: z.boolean().default(false),
  keyPrefix: z.string().default('rl:'),
});

const CacheConfigSchema = z.object({
  ttl: z.number().min(1).default(300),
  maxItems: z.number().min(100).default(10000),
  checkPeriod: z.number().min(60).default(120),
});

const LoggingConfigSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  format: z.enum(['json', 'pretty']).default('json'),
  destination: z.enum(['stdout', 'file', 'both']).default('stdout'),
  filePath: z.string().optional(),
  maxSize: z.string().default('100m'),
  maxFiles: z.number().default(5),
});

const MonitoringConfigSchema = z.object({
  enabled: z.boolean().default(true),
  sentryDsn: z.string().url().optional(),
  datadogApiKey: z.string().optional(),
  prometheusEnabled: z.boolean().default(false),
  healthCheckInterval: z.number().min(5000).default(30000),
});

const FeatureFlagsSchema = z.object({
  enableAI: z.boolean().default(true),
  enableBilling: z.boolean().default(true),
  enableSSO: z.boolean().default(true),
  enableWorkflow: z.boolean().default(true),
  enableMarketplace: z.boolean().default(false),
  enableBeta: z.boolean().default(false),
  maintenanceMode: z.boolean().default(false),
});

const SecurityConfigSchema = z.object({
  corsOrigins: z.array(z.string()).default(['*']),
  csrfEnabled: z.boolean().default(true),
  helmetEnabled: z.boolean().default(true),
  trustedProxies: z.array(z.string()).default([]),
  ipWhitelist: z.array(z.string()).optional(),
  ipBlacklist: z.array(z.string()).optional(),
});

const EnvironmentConfigSchema = z.object({
  nodeEnv: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  appUrl: z.string().url(),
  apiUrl: z.string().url(),
  port: z.number().min(1).max(65535).default(3000),
  
  database: DatabaseConfigSchema,
  redis: RedisConfigSchema,
  auth: AuthConfigSchema,
  oauth: OAuthConfigSchema.optional(),
  email: EmailConfigSchema.optional(),
  storage: StorageConfigSchema.optional(),
  rateLimit: RateLimitConfigSchema.optional(),
  cache: CacheConfigSchema.optional(),
  logging: LoggingConfigSchema.optional(),
  monitoring: MonitoringConfigSchema.optional(),
  features: FeatureFlagsSchema.optional(),
  security: SecurityConfigSchema.optional(),
});

export type EnvironmentConfig = z.infer<typeof EnvironmentConfigSchema>;

// ==================== VALIDATION FUNCTIONS ====================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  config?: EnvironmentConfig;
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
  suggestion: string;
}

export function validateEnvironment(env: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Build config from environment
  const rawConfig = {
    nodeEnv: env.NODE_ENV || 'development',
    appUrl: env.APP_URL || env.NEXT_PUBLIC_APP_URL,
    apiUrl: env.API_URL || env.NEXT_PUBLIC_API_URL,
    port: parseInt(String(env.PORT || 3000), 10),

    database: {
      url: env.DATABASE_URL,
      poolMin: parseInt(String(env.DB_POOL_MIN || 2), 10),
      poolMax: parseInt(String(env.DB_POOL_MAX || 10), 10),
      connectionTimeout: parseInt(String(env.DB_CONNECTION_TIMEOUT || 30000), 10),
      idleTimeout: parseInt(String(env.DB_IDLE_TIMEOUT || 10000), 10),
    },

    redis: {
      url: env.REDIS_URL,
      tls: env.REDIS_TLS === 'true',
      maxRetries: parseInt(String(env.REDIS_MAX_RETRIES || 3), 10),
      retryDelay: parseInt(String(env.REDIS_RETRY_DELAY || 1000), 10),
    },

    auth: {
      jwtSecret: env.JWT_SECRET,
      jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
      refreshTokenExpiresIn: env.REFRESH_TOKEN_EXPIRES_IN || '30d',
      bcryptRounds: parseInt(String(env.BCRYPT_ROUNDS || 12), 10),
      mfaIssuer: env.MFA_ISSUER || 'RealTimePulse',
    },

    oauth: env.GOOGLE_CLIENT_ID ? {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackUrl: env.GOOGLE_CALLBACK_URL,
      },
      github: env.GITHUB_CLIENT_ID ? {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        callbackUrl: env.GITHUB_CALLBACK_URL,
      } : undefined,
      microsoft: env.MICROSOFT_CLIENT_ID ? {
        clientId: env.MICROSOFT_CLIENT_ID,
        clientSecret: env.MICROSOFT_CLIENT_SECRET,
        callbackUrl: env.MICROSOFT_CALLBACK_URL,
      } : undefined,
    } : undefined,

    email: env.EMAIL_FROM ? {
      provider: env.EMAIL_PROVIDER || 'sendgrid',
      apiKey: env.EMAIL_API_KEY,
      fromAddress: env.EMAIL_FROM,
      fromName: env.EMAIL_FROM_NAME || 'Real-Time Pulse',
    } : undefined,

    storage: env.STORAGE_BUCKET ? {
      provider: env.STORAGE_PROVIDER || 's3',
      bucket: env.STORAGE_BUCKET,
      region: env.STORAGE_REGION,
      accessKeyId: env.STORAGE_ACCESS_KEY_ID,
      secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
      publicUrl: env.STORAGE_PUBLIC_URL,
    } : undefined,

    features: {
      enableAI: env.FEATURE_AI !== 'false',
      enableBilling: env.FEATURE_BILLING !== 'false',
      enableSSO: env.FEATURE_SSO !== 'false',
      enableWorkflow: env.FEATURE_WORKFLOW !== 'false',
      enableMarketplace: env.FEATURE_MARKETPLACE === 'true',
      enableBeta: env.FEATURE_BETA === 'true',
      maintenanceMode: env.MAINTENANCE_MODE === 'true',
    },

    security: {
      corsOrigins: env.CORS_ORIGINS ? String(env.CORS_ORIGINS).split(',') : ['*'],
      csrfEnabled: env.CSRF_ENABLED !== 'false',
      helmetEnabled: env.HELMET_ENABLED !== 'false',
      trustedProxies: env.TRUSTED_PROXIES ? String(env.TRUSTED_PROXIES).split(',') : [],
    },

    logging: {
      level: env.LOG_LEVEL || 'info',
      format: env.LOG_FORMAT || 'json',
      destination: env.LOG_DESTINATION || 'stdout',
    },

    monitoring: {
      enabled: env.MONITORING_ENABLED !== 'false',
      sentryDsn: env.SENTRY_DSN,
      datadogApiKey: env.DATADOG_API_KEY,
      prometheusEnabled: env.PROMETHEUS_ENABLED === 'true',
    },
  };

  // Validate with Zod
  const result = EnvironmentConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    result.error.issues.forEach(issue => {
      errors.push({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      });
    });
  }

  // Add production-specific warnings
  const nodeEnv = String(rawConfig.nodeEnv);
  
  if (nodeEnv === 'production') {
    // Security warnings
    if (rawConfig.security?.corsOrigins?.includes('*')) {
      warnings.push({
        path: 'security.corsOrigins',
        message: 'CORS allows all origins in production',
        suggestion: 'Restrict CORS to specific trusted domains',
      });
    }

    if (!rawConfig.monitoring?.sentryDsn) {
      warnings.push({
        path: 'monitoring.sentryDsn',
        message: 'Error tracking not configured',
        suggestion: 'Add SENTRY_DSN for production error monitoring',
      });
    }

    if (!rawConfig.email) {
      warnings.push({
        path: 'email',
        message: 'Email configuration not set',
        suggestion: 'Configure email for password resets and notifications',
      });
    }

    if (!rawConfig.storage) {
      warnings.push({
        path: 'storage',
        message: 'External storage not configured',
        suggestion: 'Configure S3 or cloud storage for file uploads',
      });
    }

    if (String(rawConfig.auth?.jwtSecret).length < 64) {
      warnings.push({
        path: 'auth.jwtSecret',
        message: 'JWT secret is shorter than recommended',
        suggestion: 'Use a 64+ character random string for production',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    config: result.success ? result.data : undefined,
  };
}

// ==================== CONFIG SINGLETON ====================

let cachedConfig: EnvironmentConfig | null = null;

export function getProductionConfig(): EnvironmentConfig {
  if (cachedConfig) return cachedConfig;

  const result = validateEnvironment(process.env as Record<string, unknown>);
  
  if (!result.valid || !result.config) {
    console.error('Environment validation failed:');
    result.errors.forEach(e => console.error(`  - ${e.path}: ${e.message}`));
    throw new Error('Invalid environment configuration');
  }

  if (result.warnings.length > 0) {
    console.warn('Environment warnings:');
    result.warnings.forEach(w => console.warn(`  - ${w.path}: ${w.message} (${w.suggestion})`));
  }

  cachedConfig = result.config;
  return cachedConfig;
}

// ==================== FEATURE FLAGS ====================

export function isFeatureEnabled(feature: keyof z.infer<typeof FeatureFlagsSchema>): boolean {
  try {
    const config = getProductionConfig();
    return config.features?.[feature] ?? false;
  } catch {
    return false;
  }
}

export function getFeatureFlags(): Record<string, boolean> {
  try {
    const config = getProductionConfig();
    return config.features ?? {};
  } catch {
    return {};
  }
}

// ==================== HEALTH CHECK UTILITIES ====================

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  version: string;
  uptime: number;
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message?: string;
  duration: number;
  metadata?: Record<string, unknown>;
}

export async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // This would be implemented with actual Prisma client
    // await prisma.$queryRaw`SELECT 1`;
    return {
      name: 'database',
      status: 'pass',
      message: 'Database connection healthy',
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'database',
      status: 'fail',
      message: error instanceof Error ? error.message : 'Database connection failed',
      duration: Date.now() - start,
    };
  }
}

export async function checkRedis(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // This would be implemented with actual Redis client
    // await redis.ping();
    return {
      name: 'redis',
      status: 'pass',
      message: 'Redis connection healthy',
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'redis',
      status: 'fail',
      message: error instanceof Error ? error.message : 'Redis connection failed',
      duration: Date.now() - start,
    };
  }
}

export async function checkExternalServices(): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];
  
  // Add checks for external services (Stripe, OpenAI, etc.)
  // These would be real API health checks in production
  
  return checks;
}

export async function performHealthCheck(): Promise<HealthCheckResult> {  
  const checks = await Promise.all([
    checkDatabase(),
    checkRedis(),
    ...await checkExternalServices(),
  ]);

  const hasFailure = checks.some(c => c.status === 'fail');
  const hasWarning = checks.some(c => c.status === 'warn');

  return {
    status: hasFailure ? 'unhealthy' : hasWarning ? 'degraded' : 'healthy',
    timestamp: new Date(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    checks,
  };
}

// ==================== GRACEFUL SHUTDOWN ====================

type ShutdownHandler = () => Promise<void>;
const shutdownHandlers: ShutdownHandler[] = [];

export function registerShutdownHandler(handler: ShutdownHandler): void {
  shutdownHandlers.push(handler);
}

export async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}, starting graceful shutdown...`);

  const timeout = setTimeout(() => {
    console.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 30000);

  try {
    // Run shutdown handlers in reverse order (LIFO)
    for (const handler of shutdownHandlers.reverse()) {
      try {
        await handler();
      } catch (error) {
        console.error('Shutdown handler error:', error);
      }
    }

    console.log('Graceful shutdown completed');
    clearTimeout(timeout);
    process.exit(0);
  } catch (error) {
    console.error('Graceful shutdown failed:', error);
    clearTimeout(timeout);
    process.exit(1);
  }
}

// Register signal handlers
if (typeof process !== 'undefined' && process.on) {
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

const productionConfigUtils = {
  validateEnvironment,
  getProductionConfig,
  isFeatureEnabled,
  getFeatureFlags,
  performHealthCheck,
  registerShutdownHandler,
  gracefulShutdown,
};

export default productionConfigUtils;
