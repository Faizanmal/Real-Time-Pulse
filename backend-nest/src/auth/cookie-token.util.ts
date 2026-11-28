export function readCookieValue(cookieHeader: string | string[] | undefined, cookieName: string): string | null {
  const header = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...valueParts] = part.trim().split('=');
    if (name !== cookieName) continue;
    try {
      return decodeURIComponent(valueParts.join('='));
    } catch {
      return null;
    }
  }
  return null;
}
