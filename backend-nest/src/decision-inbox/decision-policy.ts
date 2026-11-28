export interface EscalationWindow {
  timeZone: string;
  businessDays: number[];
  businessHoursStart: string;
  businessHoursEnd: string;
}

const WEEKDAY_NUMBER: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function isWithinBusinessHours(
  now: Date,
  window: EscalationWindow,
): boolean {
  if (!isValidTimeZone(window.timeZone)) return false;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: window.timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const day = WEEKDAY_NUMBER[values.weekday];
  if (day === undefined || !window.businessDays.includes(day)) return false;
  const minuteOfDay = Number(values.hour) * 60 + Number(values.minute);
  const start = parseClock(window.businessHoursStart);
  const end = parseClock(window.businessHoursEnd);
  if (start === null || end === null || start >= end) return false;
  return minuteOfDay >= start && minuteOfDay < end;
}

export function isReminderDue(
  now: Date,
  decision: { dueAt: Date | null; lastReminderAt: Date | null; reminderCount: number },
  policy: EscalationWindow & {
    enabled: boolean;
    notificationOptIn: boolean;
    reminderIntervalMinutes: number;
    maxReminders: number;
  },
): boolean {
  if (!policy.enabled || !policy.notificationOptIn) return false;
  if (!decision.dueAt || decision.dueAt > now || decision.reminderCount >= policy.maxReminders)
    return false;
  if (!isWithinBusinessHours(now, policy)) return false;
  const earliestNext = decision.lastReminderAt
    ? decision.lastReminderAt.getTime() + policy.reminderIntervalMinutes * 60_000
    : decision.dueAt.getTime();
  return now.getTime() >= earliestNext;
}

function parseClock(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}
