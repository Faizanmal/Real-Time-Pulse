import {
  classifyConnectorFailure,
  integrationTokenWritesEnabled,
  protectIntegrationTokens,
  revealIntegrationTokens,
  redactConnectorSettings,
  toPublicIntegration,
} from './connector-security.util';

describe('connector security contracts', () => {
  const cipher = {
    encrypt: (value: string) => `cipher:${Buffer.from(value).toString('base64')}`,
    decrypt: (value: string) => {
      if (!value.startsWith('cipher:')) throw new Error('Invalid ciphertext');
      return Buffer.from(value.slice('cipher:'.length), 'base64').toString();
    },
  };

  it('encrypts new access/refresh tokens and decrypts them without changing the API contract', () => {
    const stored = protectIntegrationTokens(cipher, {
      accessToken: 'fictional-access-token',
      refreshToken: 'fictional-refresh-token',
    }, {});
    expect(stored).toMatchObject({ tokenEncryptionVersion: 1 });
    expect(stored.accessToken).not.toContain('fictional-access-token');
    expect(stored.refreshToken).not.toContain('fictional-refresh-token');
    expect(revealIntegrationTokens(cipher, stored)).toMatchObject({
      accessToken: 'fictional-access-token',
      refreshToken: 'fictional-refresh-token',
      tokenEncryptionVersion: 1,
    });
  });

  it('reads legacy plaintext and preserves null refresh credentials during migration', () => {
    const legacy = { accessToken: 'fictional-legacy-token', refreshToken: null, tokenEncryptionVersion: 0 };
    expect(revealIntegrationTokens(cipher, legacy)).toEqual(legacy);
    const encoded = protectIntegrationTokens(cipher, legacy, {});
    expect(encoded.refreshToken).toBeNull();
    expect(revealIntegrationTokens(cipher, encoded).accessToken).toBe(legacy.accessToken);
  });

  it('fails closed for tampered ciphertext and unknown versions', () => {
    expect(() => revealIntegrationTokens(cipher, {
      accessToken: 'damaged-ciphertext', tokenEncryptionVersion: 1,
    })).toThrow('Invalid ciphertext');
    expect(() => revealIntegrationTokens(cipher, {
      accessToken: 'ciphertext', tokenEncryptionVersion: 99,
    })).toThrow('Unsupported integration token encryption version');
  });

  it('supports only the explicit prepare phase for temporary plaintext writes', () => {
    expect(integrationTokenWritesEnabled({} as NodeJS.ProcessEnv)).toBe(true);
    expect(integrationTokenWritesEnabled({ INTEGRATION_TOKEN_ENCRYPTION_WRITE_ENABLED: 'false' } as NodeJS.ProcessEnv)).toBe(false);
    expect(protectIntegrationTokens(cipher, { accessToken: 'fictional-legacy-write' }, {
      INTEGRATION_TOKEN_ENCRYPTION_WRITE_ENABLED: 'false',
    } as NodeJS.ProcessEnv)).toMatchObject({ accessToken: 'fictional-legacy-write', tokenEncryptionVersion: 0 });
  });

  it('never includes integration token columns in the public response', () => {
    const dto = toPublicIntegration({
      id: 'integration-a',
      workspaceId: 'tenant-a',
      provider: 'GITHUB',
      accessToken: 'secret-access-value',
      refreshToken: 'secret-refresh-value',
      status: 'ACTIVE',
      settings: {
        syncInterval: 60,
        endpoint:
          'https://fixture-user:fixture-pass@provider.invalid/path?access_token=fixture-query-token',
        nested: { apiKey: 'also-secret', region: 'test' },
      },
      lastSyncedAt: new Date('2026-01-01T00:00:00Z'),
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });
    const serialized = JSON.stringify(dto);
    expect(serialized).not.toContain('secret-access-value');
    expect(serialized).not.toContain('secret-refresh-value');
    expect(serialized).not.toContain('tenant-a');
    expect(serialized).not.toContain('also-secret');
    expect(serialized).not.toContain('fixture-user');
    expect(serialized).not.toContain('fixture-pass');
    expect(serialized).not.toContain('fixture-query-token');
    expect(dto.settings).toEqual({
      syncInterval: 60,
      endpoint: 'https://[redacted]@provider.invalid/path?access_token=[redacted]',
      nested: { region: 'test' },
    });
  });

  it('maps invalid grants to reconnect and rate limits to degraded while preserving safe messages', () => {
    expect(
      classifyConnectorFailure({ response: { status: 400, data: { error: 'invalid_grant' } } }),
    ).toMatchObject({ state: 'NEEDS_RECONNECT', code: 'invalid_grant' });
    expect(classifyConnectorFailure({ response: { status: 429 } })).toMatchObject({
      state: 'DEGRADED',
      code: 'rate_limited',
    });
    expect(classifyConnectorFailure({ response: { status: 503 } })).toMatchObject({
      state: 'DEGRADED',
      code: 'provider_unavailable',
    });
  });

  it('redacts secret-shaped settings keys recursively', () => {
    expect(
      redactConnectorSettings({
        apiKey: 'hidden',
        nested: { refresh_token: 'hidden', label: 'safe' },
      }),
    ).toEqual({ nested: { label: 'safe' } });
  });

  it('redacts credentials embedded inside connector setting URLs', () => {
    expect(
      redactConnectorSettings(
        'mqtts://fixture-user:fixture-pass@broker.invalid/?token=fixture-token',
      ),
    ).toBe('mqtts://[redacted]@broker.invalid/?token=[redacted]');
  });
});
