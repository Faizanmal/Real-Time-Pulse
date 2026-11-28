import { timingSafeEqual } from 'crypto';

import { ForbiddenException } from '@nestjs/common';

import type { CacheService } from '../../cache/cache.service';

export function isValidOAuthState(expected: string, supplied: string): boolean {
  return Boolean(
    expected &&
    supplied &&
    expected.length === supplied.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(supplied)),
  );
}

export async function consumeOAuthStateOnce(
  cacheService: Pick<CacheService, 'consume'>,
  provider: 'google' | 'github',
  expected: string,
  supplied: string,
): Promise<void> {
  if (!isValidOAuthState(expected, supplied)) {
    throw new ForbiddenException('OAuth state validation failed');
  }

  const consumed = await cacheService.consume(`oauth_state:${provider}:${expected}`);
  if (!consumed) {
    throw new ForbiddenException('OAuth state expired or already used');
  }
}
