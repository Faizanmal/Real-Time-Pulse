import { nextScheduledInstant } from './schedule-time';

describe('nextScheduledInstant', () => {
  it('keeps a local business-hour schedule at 09:00 across the DST transition', () => {
    const next = nextScheduledInstant('0 9 * * 1-5', 'America/New_York', new Date('2026-03-07T14:00:00.000Z'));
    expect(next.toISOString()).toBe('2026-03-09T13:00:00.000Z');
  });

  it('rejects invalid timezones and invalid cron expressions instead of silently guessing', () => {
    expect(() => nextScheduledInstant('0 9 * * 1-5', 'Mars/Olympus')).toThrow('Invalid IANA timezone');
    expect(() => nextScheduledInstant('not a schedule', 'UTC')).toThrow();
  });
});
