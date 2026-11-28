import { EncryptionService } from '../common/services/encryption.service';

import { protectIntegrationTokens, revealIntegrationTokens } from './connector-security.util';

describe('integration token at-rest encryption', () => {
  const encryption = new EncryptionService({
    get: jest.fn().mockReturnValue('fictional-test-encryption-key-with-more-than-32-bytes'),
  } as any);

  it('stores authenticated AES-GCM ciphertext and restores fictional provider credentials', () => {
    const stored = protectIntegrationTokens(encryption, {
      accessToken: 'fictional-access-token',
      refreshToken: 'fictional-refresh-token',
    }, {});

    expect(stored.tokenEncryptionVersion).toBe(1);
    expect(stored.accessToken).not.toContain('fictional-access-token');
    expect(stored.refreshToken).not.toContain('fictional-refresh-token');
    expect(revealIntegrationTokens(encryption, stored)).toMatchObject({
      accessToken: 'fictional-access-token',
      refreshToken: 'fictional-refresh-token',
      tokenEncryptionVersion: 1,
    });
  });

  it('preserves legacy plaintext reads and migrates a null refresh token', () => {
    const stored = { accessToken: 'fictional-legacy-access', refreshToken: null, tokenEncryptionVersion: 0 };
    expect(revealIntegrationTokens(encryption, stored)).toBe(stored);
    const migrated = protectIntegrationTokens(encryption, stored, {});
    expect(migrated).toMatchObject({ tokenEncryptionVersion: 1, refreshToken: null });
    expect(revealIntegrationTokens(encryption, migrated).accessToken).toBe(stored.accessToken);
  });

  it('fails closed on ciphertext tampering and unsupported format versions', () => {
    const stored = protectIntegrationTokens(encryption, { accessToken: 'fictional-access' }, {});
    const damaged = `${stored.accessToken.slice(0, -4)}AAAA`;
    expect(() => revealIntegrationTokens(encryption, {
      ...stored,
      accessToken: damaged,
    })).toThrow();
    expect(() => revealIntegrationTokens(encryption, {
      ...stored,
      tokenEncryptionVersion: 2,
    })).toThrow('Unsupported integration token encryption version');
  });

  it('keeps encrypted existing records encrypted during the prepare phase', () => {
    const stored = protectIntegrationTokens(encryption, { accessToken: 'fictional-old-token' }, {}, 1);
    expect(stored.tokenEncryptionVersion).toBe(1);
    expect(revealIntegrationTokens(encryption, stored).accessToken).toBe('fictional-old-token');
  });
});
