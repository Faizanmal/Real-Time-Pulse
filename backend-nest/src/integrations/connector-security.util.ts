export type ConnectorState = 'CONNECTED' | 'DEGRADED' | 'NEEDS_RECONNECT' | 'DISCONNECTED';

export interface TokenCipher {
  encrypt(value: string): string;
  decrypt(value: string): string;
}

export interface IntegrationTokenRecord {
  accessToken: string;
  refreshToken?: string | null;
  tokenEncryptionVersion?: number;
}

export function integrationTokenWritesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.INTEGRATION_TOKEN_ENCRYPTION_WRITE_ENABLED !== 'false';
}

export function protectIntegrationTokens(
  cipher: TokenCipher,
  tokens: { accessToken: string; refreshToken?: string | null },
  env: NodeJS.ProcessEnv = process.env,
  existingVersion = 0,
) {
  const version = existingVersion === 1 || integrationTokenWritesEnabled(env) ? 1 : 0;
  return {
    accessToken: version === 1 ? cipher.encrypt(tokens.accessToken) : tokens.accessToken,
    ...(tokens.refreshToken === undefined ? {} : {
      refreshToken: tokens.refreshToken === null
        ? null
        : version === 1
          ? cipher.encrypt(tokens.refreshToken)
          : tokens.refreshToken,
    }),
    tokenEncryptionVersion: version,
  };
}

export function revealIntegrationTokens<T extends IntegrationTokenRecord>(cipher: TokenCipher, record: T): T {
  if ((record.tokenEncryptionVersion ?? 0) === 0) return record;
  if (record.tokenEncryptionVersion !== 1) {
    throw new Error('Unsupported integration token encryption version');
  }
  return {
    ...record,
    accessToken: cipher.decrypt(record.accessToken),
    refreshToken: record.refreshToken ? cipher.decrypt(record.refreshToken) : record.refreshToken,
  };
}

export interface ConnectorFailure {
  state: Exclude<ConnectorState, 'CONNECTED' | 'DISCONNECTED'>;
  code:
    'invalid_grant' | 'unauthorized' | 'rate_limited' | 'provider_unavailable' | 'provider_error';
  message: string;
}

export function classifyConnectorFailure(error: unknown): ConnectorFailure {
  const value = error as {
    code?: string;
    message?: string;
    response?: { status?: number; data?: { error?: string; code?: string } };
  };
  const providerCode =
    `${value?.code ?? ''} ${value?.response?.data?.error ?? ''} ${value?.response?.data?.code ?? ''}`.toLowerCase();
  const status = value?.response?.status;

  if (providerCode.includes('invalid_grant')) {
    return {
      state: 'NEEDS_RECONNECT',
      code: 'invalid_grant',
      message: 'Reconnect this provider account to continue syncing.',
    };
  }
  if (
    status === 401 ||
    status === 403 ||
    providerCode.includes('unauthorized') ||
    providerCode.includes('invalid_token')
  ) {
    return {
      state: 'NEEDS_RECONNECT',
      code: 'unauthorized',
      message: 'Reconnect this provider account to continue syncing.',
    };
  }
  if (status === 429 || providerCode.includes('rate_limit')) {
    return {
      state: 'DEGRADED',
      code: 'rate_limited',
      message:
        'The provider is rate limiting requests. The last successful sync time is retained.',
    };
  }
  if (providerCode.includes('sync_not_configured')) {
    return {
      state: 'DEGRADED',
      code: 'provider_error',
      message:
        'This connector sync handler is not configured. The last successful sync time is retained.',
    };
  }
  const transportCode = (value?.code ?? '').toUpperCase();
  if (
    (typeof status === 'number' && status >= 500) ||
    ['ECONNABORTED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'].includes(transportCode)
  ) {
    return {
      state: 'DEGRADED',
      code: 'provider_unavailable',
      message:
        'The provider is temporarily unavailable. The last successful sync time is retained.',
    };
  }
  return {
    state: 'DEGRADED',
    code: 'provider_error',
    message:
      'The provider sync failed. The last successful sync time is retained.',
  };
}

export function providerHttpStatus(error: unknown): string {
  const status = (error as { response?: { status?: unknown } })?.response?.status;
  return typeof status === 'number' ? String(status) : 'unavailable';
}

export function connectorStateMessage(state: ConnectorState): string {
  switch (state) {
    case 'CONNECTED':
      return 'Connected and syncing.';
    case 'DEGRADED':
      return 'Sync is delayed. The last successful sync time is shown.';
    case 'NEEDS_RECONNECT':
      return 'Provider authorization needs attention. Reconnect this account.';
    case 'DISCONNECTED':
      return 'This connector is disconnected.';
  }
}

const SENSITIVE_SETTING_KEY =
  /(access.?token|refresh.?token|token|secret|password|credential|api.?key|authorization|private.?key)/i;

export function redactConnectorSettings(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactConnectorSettings);
  if (typeof value === 'string') {
    return value
      .replace(/([a-z][a-z0-9+.-]*:\/\/)[^/@\s]+:[^/@\s]+@/gi, '$1[redacted]@')
      .replace(
        /([?&](?:access_token|refresh_token|token|api_key|apikey|secret|password|signature|auth)=)[^&\s]+/gi,
        '$1[redacted]',
      )
      .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi, '$1 [redacted]');
  }
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SENSITIVE_SETTING_KEY.test(key))
      .map(([key, item]) => [key, redactConnectorSettings(item)]),
  );
}

export function toPublicIntegration(integration: Record<string, any>) {
  const connectionState =
    integration.connectionState ??
    (integration.status === 'EXPIRED'
      ? 'NEEDS_RECONNECT'
      : integration.status === 'ERROR'
        ? 'DEGRADED'
        : integration.status === 'INACTIVE'
          ? 'DISCONNECTED'
          : 'CONNECTED');

  return {
    id: integration.id,
    provider: integration.provider,
    accountId: integration.accountId ?? null,
    accountName: integration.accountName ?? null,
    scopes: integration.scopes ?? null,
    settings: redactConnectorSettings(integration.settings ?? {}) as Record<string, unknown>,
    status: integration.status,
    connectionState,
    statusMessage: connectorStateMessage(connectionState),
    lastSyncedAt: integration.lastSyncedAt ?? null,
    lastValidDataAt: integration.lastValidDataAt ?? integration.lastSyncedAt ?? null,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
    isDemo:
      integration.provider === 'DEMO' ||
      (integration.settings as Record<string, unknown> | undefined)?.isDemo === true,
  };
}
