import { isReminderDue, isWithinBusinessHours, isValidTimeZone } from './decision-policy';

const window = {
  timeZone: 'America/New_York',
  businessDays: [1, 2, 3, 4, 5],
  businessHoursStart: '09:00',
  businessHoursEnd: '17:00',
};

describe('decision escalation business windows', () => {
  it('uses the configured IANA zone and handles DST transitions', () => {
    expect(isValidTimeZone('America/New_York')).toBe(true);
    expect(isValidTimeZone('Not/A_Zone')).toBe(false);
    // March 9 2026 is Monday after the US DST transition; 13:30Z is 09:30 EDT.
    expect(isWithinBusinessHours(new Date('2026-03-09T13:30:00.000Z'), window)).toBe(true);
    // November 2 2026 is Monday after the fall-back transition; 14:30Z is 09:30 EST.
    expect(isWithinBusinessHours(new Date('2026-11-02T14:30:00.000Z'), window)).toBe(true);
  });

  it('suppresses weekends, outside-hours delivery, no-opt-in and repeated reminders', () => {
    const policy = {
      ...window,
      enabled: true,
      notificationOptIn: true,
      reminderIntervalMinutes: 1440,
      maxReminders: 2,
    };
    const decision = {
      dueAt: new Date('2026-03-09T12:00:00.000Z'),
      lastReminderAt: null,
      reminderCount: 0,
    };
    expect(isReminderDue(new Date('2026-03-09T13:30:00.000Z'), decision, policy)).toBe(true);
    expect(isReminderDue(new Date('2026-03-09T22:30:00.000Z'), decision, policy)).toBe(false);
    expect(isReminderDue(new Date('2026-03-14T14:00:00.000Z'), decision, policy)).toBe(false);
    expect(isReminderDue(new Date('2026-03-09T13:30:00.000Z'), decision, { ...policy, notificationOptIn: false })).toBe(false);
    expect(isReminderDue(new Date('2026-03-11T13:30:00.000Z'), { ...decision, lastReminderAt: new Date('2026-03-10T13:30:00.000Z'), reminderCount: 1 }, policy)).toBe(true);
    expect(isReminderDue(new Date('2026-03-11T13:30:00.000Z'), { ...decision, lastReminderAt: new Date('2026-03-10T14:00:00.000Z'), reminderCount: 1 }, policy)).toBe(false);
    expect(isReminderDue(new Date('2026-03-12T13:30:00.000Z'), { ...decision, reminderCount: 2 }, policy)).toBe(false);
  });
});
