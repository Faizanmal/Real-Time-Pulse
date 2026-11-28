import { sanitizeSensitivePath } from './sensitive-path';

describe('sanitizeSensitivePath', () => {
  it('redacts public share tokens and strips query data', () => {
    expect(sanitizeSensitivePath('/api/v1/share-links/public/private-token/comments?password=secret'))
      .toBe('/api/v1/share-links/public/[redacted]/comments');
    expect(sanitizeSensitivePath('/api/v1/portals/share/legacy-token/view'))
      .toBe('/api/v1/portals/share/[redacted]/view');
  });
});
