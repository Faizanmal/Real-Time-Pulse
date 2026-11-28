/** Strip query data and public bearer tokens before persisting request paths. */
export function sanitizeSensitivePath(path: string): string {
  return path
    .split('?')[0]
    .replace(/(\/(?:share-links\/public|portals\/share)\/)[^/]+/gi, '$1[redacted]');
}
