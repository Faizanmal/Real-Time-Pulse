import { registerAs } from '@nestjs/config';

export default registerAs('security', () => ({
  // Password policy
  password: {
    minLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '12', 10),
    maxLength: parseInt(process.env.PASSWORD_MAX_LENGTH || '128', 10),
    requireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== 'false',
    requireLowercase: process.env.PASSWORD_REQUIRE_LOWERCASE !== 'false',
    requireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS !== 'false',
    requireSpecial: process.env.PASSWORD_REQUIRE_SPECIAL !== 'false',
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  },

  // Rate limiting
  rateLimit: {
    global: {
      ttl: parseInt(process.env.RATE_LIMIT_TTL || '60000', 10), // 1 minute
      limit: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    },
    auth: {
      ttl: parseInt(process.env.AUTH_RATE_LIMIT_TTL || '900000', 10), // 15 minutes
      limit: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5', 10),
    },
    api: {
      ttl: parseInt(process.env.API_RATE_LIMIT_TTL || '60000', 10),
      limit: parseInt(process.env.API_RATE_LIMIT_MAX || '1000', 10),
    },
  },

  // Session & Token
  session: {
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '5', 10),
    refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '30d',
    accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
  },

  // CORS
  cors: {
    allowedOrigins: (
      process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3001'
    ).split(','),
    allowCredentials: process.env.CORS_ALLOW_CREDENTIALS !== 'false',
    maxAge: parseInt(process.env.CORS_MAX_AGE || '86400', 10),
  },

  // Security headers
  headers: {
    hsts: {
      maxAge: parseInt(process.env.HSTS_MAX_AGE || '31536000', 10),
      includeSubDomains: process.env.HSTS_INCLUDE_SUBDOMAINS !== 'false',
      preload: process.env.HSTS_PRELOAD === 'true',
    },
    contentSecurityPolicy: process.env.CSP_ENABLED !== 'false',
    xFrameOptions: process.env.X_FRAME_OPTIONS || 'DENY',
  },

  // Bot protection
  recaptcha: {
    enabled: process.env.RECAPTCHA_ENABLED === 'true',
    siteKey: process.env.RECAPTCHA_SITE_KEY,
    secretKey: process.env.RECAPTCHA_SECRET_KEY,
    minScore: parseFloat(process.env.RECAPTCHA_MIN_SCORE || '0.5'),
  },

  // IP blocking
  ipBlocking: {
    enabled: process.env.IP_BLOCKING_ENABLED !== 'false',
    maxFailedAttempts: parseInt(process.env.IP_MAX_FAILED_ATTEMPTS || '10', 10),
    blockDurationMinutes: parseInt(
      process.env.IP_BLOCK_DURATION_MINUTES || '30',
      10,
    ),
  },

  // Encryption
  encryption: {
    algorithm: 'aes-256-gcm',
    keyDerivation: 'pbkdf2',
    iterations: parseInt(process.env.ENCRYPTION_ITERATIONS || '100000', 10),
  },

  // Audit logging
  audit: {
    enabled: process.env.AUDIT_LOGGING_ENABLED !== 'false',
    retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS || '365', 10),
    sensitiveFields: [
      'password',
      'token',
      'secret',
      'apiKey',
      'accessToken',
      'refreshToken',
    ],
  },
}));
