import { CronExpressionParser } from 'cron-parser';

export function nextScheduledInstant(expression: string, timezone: string, now = new Date()): Date {
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone }).format(now);
  } catch {
    throw new Error('Invalid IANA timezone');
  }
  const fields = expression.trim().split(/\s+/);
  const normalized = fields.length === 5 ? `0 ${expression}` : expression;
  return CronExpressionParser.parse(normalized, { currentDate: now, tz: timezone, strict: true }).next().toDate();
}
