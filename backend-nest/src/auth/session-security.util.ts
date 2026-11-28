export const SESSION_CSRF_HEADER_VALUE = 'browser-session';

export function isTrustedSessionRequest(
  origin: string | undefined,
  csrfHeader: string | string[] | undefined,
  allowedOrigins: string[],
): boolean {
  return Boolean(
    origin &&
    allowedOrigins.includes(origin) &&
    typeof csrfHeader === 'string' &&
    csrfHeader === SESSION_CSRF_HEADER_VALUE,
  );
}
