type Environment = Record<string, string | undefined>;

const PLACEHOLDER_MARKERS = ['local-only-placeholder', 'replace-with', 'change-before-deploy'];

/** Validate only the configuration required to boot the API and its core stores. */
export function validateEnvironment(config: Environment): Environment {
  const errors: string[] = [];
  const required = ['DATABASE_URL', 'JWT_SECRET', 'ENCRYPTION_KEY'] as const;

  for (const key of required) {
    const value = config[key]?.trim();
    if (!value) {
      errors.push(`${key} is missing`);
      continue;
    }

    if (config.NODE_ENV === 'production' && PLACEHOLDER_MARKERS.some((marker) => value.includes(marker))) {
      errors.push(`${key} must not use a documented placeholder`);
    }
  }

  if (config.DATABASE_URL && !/^postgres(?:ql)?:\/\//i.test(config.DATABASE_URL)) {
    errors.push('DATABASE_URL must use the PostgreSQL URL format');
  }

  if (config.JWT_SECRET && config.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must contain at least 32 characters');
  }

  if (config.ENCRYPTION_KEY && config.ENCRYPTION_KEY.length < 32) {
    errors.push('ENCRYPTION_KEY must contain at least 32 characters');
  }

  if (
    config.NODE_ENV === 'production' &&
    config.AUTH_LEGACY_TOKEN_RESPONSES === 'true'
  ) {
    errors.push('AUTH_LEGACY_TOKEN_RESPONSES must be false in production');
  }

  if (
    config.NODE_ENV === 'production' &&
    config.INTEGRATION_TOKEN_ENCRYPTION_WRITE_ENABLED === 'false' &&
    config.INTEGRATION_TOKEN_ENCRYPTION_ROLLOUT_PHASE !== 'prepare'
  ) {
    errors.push('Plaintext integration token writes require the explicit prepare rollout phase');
  }

  if (
    config.INTEGRATION_TOKEN_ENCRYPTION_WRITE_ENABLED !== undefined &&
    !['true', 'false'].includes(config.INTEGRATION_TOKEN_ENCRYPTION_WRITE_ENABLED)
  ) {
    errors.push('INTEGRATION_TOKEN_ENCRYPTION_WRITE_ENABLED must be true or false');
  }

  if (
    config.INTEGRATION_TOKEN_ENCRYPTION_ROLLOUT_PHASE !== undefined &&
    config.INTEGRATION_TOKEN_ENCRYPTION_ROLLOUT_PHASE !== 'prepare'
  ) {
    errors.push('INTEGRATION_TOKEN_ENCRYPTION_ROLLOUT_PHASE must be prepare when set');
  }

  for (const key of ['PORT', 'REDIS_PORT'] as const) {
    if (config[key] !== undefined) {
      const port = Number(config[key]);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        errors.push(`${key} must be an integer between 1 and 65535`);
      }
    }
  }

  if (errors.length) {
    throw new Error(`Invalid environment configuration:\n- ${errors.join('\n- ')}\nSee backend-nest/.env.example for local-only values.`);
  }

  return config;
}
