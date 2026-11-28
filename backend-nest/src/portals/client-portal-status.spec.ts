import { summarizeClientFeedStatus } from './client-portal-status';

describe('client portal feed status', () => {
  const now = new Date('2026-11-26T12:00:00.000Z');

  it('reports no data instead of inventing a successful sync', () => {
    expect(summarizeClientFeedStatus([], now)).toEqual({
      health: 'NO_DATA', lastSyncedAt: null, lastValidDataAt: null, sourceCount: 0,
    });
    expect(summarizeClientFeedStatus([{ connectionState: 'CONNECTED' }], now).health).toBe('NO_DATA');
  });

  it('marks feeds stale after the same 24-hour threshold used by metric provenance', () => {
    const old = new Date(now.getTime() - 25 * 60 * 60 * 1000);
    expect(summarizeClientFeedStatus([{ lastSyncedAt: old, lastValidDataAt: old, connectionState: 'CONNECTED' }], now)).toMatchObject({
      health: 'STALE', lastSyncedAt: old.toISOString(), lastValidDataAt: old.toISOString(), sourceCount: 1,
    });
  });

  it('reports the oldest client-visible source freshness and connector attention', () => {
    const newer = new Date(now.getTime() - 60 * 60 * 1000);
    const older = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    expect(summarizeClientFeedStatus([
      { lastSyncedAt: newer, lastValidDataAt: newer, connectionState: 'CONNECTED' },
      { lastSyncedAt: older, lastValidDataAt: older, connectionState: 'CONNECTED' },
    ], now)).toMatchObject({ health: 'CURRENT', lastSyncedAt: older.toISOString(), lastValidDataAt: older.toISOString(), sourceCount: 2 });
    expect(summarizeClientFeedStatus([{ lastSyncedAt: newer, connectionState: 'NEEDS_RECONNECT' }], now).health).toBe('ATTENTION');
    expect(summarizeClientFeedStatus([{ sourceFreshnessAt: newer, health: 'DEGRADED' }], now).health).toBe('ATTENTION');
  });

  it('uses metric health when a current sync is stale or a metric has no data', () => {
    expect(summarizeClientFeedStatus([{ sourceFreshnessAt: now, health: 'STALE' }], now).health).toBe('STALE');
    expect(summarizeClientFeedStatus([{ sourceFreshnessAt: now, health: 'MISSING' }], now).health).toBe('NO_DATA');
  });
});
