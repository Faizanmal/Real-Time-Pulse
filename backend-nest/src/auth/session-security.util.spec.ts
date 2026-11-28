import { consumeOAuthStateOnce, isValidOAuthState } from './guards/oauth-state.util';
import { isTrustedSessionRequest, SESSION_CSRF_HEADER_VALUE } from './session-security.util';

describe('browser session request guards', () => {
  it('accepts only the exact OAuth state paired with the initiating browser cookie', () => {
    expect(isValidOAuthState('random-state-value', 'random-state-value')).toBe(true);
    expect(isValidOAuthState('random-state-value', 'attacker-state-value')).toBe(false);
    expect(isValidOAuthState('', 'attacker-state-value')).toBe(false);
    expect(isValidOAuthState('short', 'longer')).toBe(false);
  });

  it('rejects forged OAuth state before consuming the valid browser state', async () => {
    const cacheService = { consume: jest.fn().mockResolvedValue('1') };
    await expect(
      consumeOAuthStateOnce(cacheService, 'google', 'expected-state', 'forged-state'),
    ).rejects.toThrow('OAuth state validation failed');
    expect(cacheService.consume).not.toHaveBeenCalled();
  });

  it('rejects an expired or replayed state after its one-time cache key is gone', async () => {
    const cacheService = { consume: jest.fn().mockResolvedValue(null) };
    await expect(
      consumeOAuthStateOnce(cacheService, 'github', 'same-state', 'same-state'),
    ).rejects.toThrow('OAuth state expired or already used');
    expect(cacheService.consume).toHaveBeenCalledWith('oauth_state:github:same-state');
  });

  it('consumes a matching OAuth state exactly once before provider authentication', async () => {
    const cacheService = { consume: jest.fn().mockResolvedValue('1') };
    await expect(
      consumeOAuthStateOnce(cacheService, 'google', 'same-state', 'same-state'),
    ).resolves.toBeUndefined();
    expect(cacheService.consume).toHaveBeenCalledTimes(1);
    expect(cacheService.consume).toHaveBeenCalledWith('oauth_state:google:same-state');
  });

  it('requires an allowed origin and the custom CSRF header for cookie session writes', () => {
    const allowlist = ['http://127.0.0.1:3001'];
    expect(
      isTrustedSessionRequest('http://127.0.0.1:3001', SESSION_CSRF_HEADER_VALUE, allowlist),
    ).toBe(true);
    expect(
      isTrustedSessionRequest('https://attacker.invalid', SESSION_CSRF_HEADER_VALUE, allowlist),
    ).toBe(false);
    expect(isTrustedSessionRequest(undefined, SESSION_CSRF_HEADER_VALUE, allowlist)).toBe(false);
    expect(isTrustedSessionRequest('http://127.0.0.1:3001', undefined, allowlist)).toBe(false);
  });
});
