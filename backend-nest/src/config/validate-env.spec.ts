import { validateEnvironment } from './validate-env';

const validEnvironment = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://pulse_test:pulse_test_only_password@127.0.0.1:55432/pulse_test',
  JWT_SECRET: 'test-only-jwt-secret-with-at-least-32-chars',
  ENCRYPTION_KEY: 'test-only-encryption-key-with-at-least-32-chars',
};

describe('validateEnvironment', () => {
  it('accepts complete local test configuration without provider credentials', () => {
    expect(validateEnvironment(validEnvironment)).toEqual(validEnvironment);
  });

  it('reports missing core settings without echoing their values', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'development' })).toThrow(/DATABASE_URL is missing/);
    expect(() => validateEnvironment({ NODE_ENV: 'development' })).toThrow(/JWT_SECRET is missing/);
  });

  it('rejects documented placeholder secrets in production', () => {
    expect(() => validateEnvironment({
      ...validEnvironment,
      NODE_ENV: 'production',
      JWT_SECRET: 'local-only-placeholder-jwt-secret-change-before-deploy',
    })).toThrow(/JWT_SECRET must not use a documented placeholder/);
  });

  it('rejects legacy token response bodies in production', () => {
    expect(() => validateEnvironment({
      ...validEnvironment,
      NODE_ENV: 'production',
      AUTH_LEGACY_TOKEN_RESPONSES: 'true',
    })).toThrow(/AUTH_LEGACY_TOKEN_RESPONSES must be false in production/);
  });

  it('allows the explicit temporary encryption prepare phase but rejects unscoped plaintext writes', () => {
    expect(() => validateEnvironment({
      ...validEnvironment,
      NODE_ENV: 'production',
      INTEGRATION_TOKEN_ENCRYPTION_WRITE_ENABLED: 'false',
    })).toThrow(/explicit prepare rollout phase/);
    expect(validateEnvironment({
      ...validEnvironment,
      NODE_ENV: 'production',
      INTEGRATION_TOKEN_ENCRYPTION_WRITE_ENABLED: 'false',
      INTEGRATION_TOKEN_ENCRYPTION_ROLLOUT_PHASE: 'prepare',
    })).toBeDefined();
  });

  it('rejects invalid ports and short cryptographic inputs', () => {
    expect(() => validateEnvironment({ ...validEnvironment, PORT: '70000' })).toThrow(/PORT must be an integer/);
    expect(() => validateEnvironment({ ...validEnvironment, ENCRYPTION_KEY: 'short' })).toThrow(/ENCRYPTION_KEY must contain at least 32 characters/);
  });
});
