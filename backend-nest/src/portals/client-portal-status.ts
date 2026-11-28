export const CLIENT_FEED_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export type ClientFeedHealth = 'CURRENT' | 'STALE' | 'ATTENTION' | 'NO_DATA';

export interface ClientFeedStatus {
  health: ClientFeedHealth;
  lastSyncedAt: string | null;
  lastValidDataAt: string | null;
  sourceCount: number;
}

type FeedRecord = {
  lastSyncedAt?: Date | string | null;
  lastValidDataAt?: Date | string | null;
  connectionState?: string | null;
  health?: string | null;
  sourceFreshnessAt?: Date | string | null;
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function oldest(values: Array<Date | null>): Date | null {
  const valid = values.filter((value): value is Date => value !== null);
  return valid.length ? new Date(Math.min(...valid.map((value) => value.getTime()))) : null;
}

/** Summarize only feeds belonging to the currently visible portal widgets/mappings. */
export function summarizeClientFeedStatus(feeds: FeedRecord[], now = new Date()): ClientFeedStatus {
  if (!feeds.length) return { health: 'NO_DATA', lastSyncedAt: null, lastValidDataAt: null, sourceCount: 0 };

  const syncDates = feeds.map((feed) => toDate(feed.lastSyncedAt ?? feed.sourceFreshnessAt));
  const validDates = feeds.map((feed) => toDate(feed.lastValidDataAt ?? feed.sourceFreshnessAt ?? feed.lastSyncedAt));
  const lastSyncedAt = oldest(syncDates);
  const lastValidDataAt = oldest(validDates);
  const unhealthy = feeds.some((feed) =>
    (feed.connectionState && feed.connectionState !== 'CONNECTED') ||
    (feed.health && !['CONNECTED', 'CURRENT', 'STALE', 'MISSING', 'NO_DATA'].includes(feed.health)),
  );
  const missing = feeds.some((feed) => feed.health === 'MISSING' || feed.health === 'NO_DATA');
  const stale = feeds.some((feed, index) => {
    if (feed.health === 'STALE') return true;
    const lastValid = validDates[index];
    return !lastValid || now.getTime() - lastValid.getTime() > CLIENT_FEED_STALE_AFTER_MS;
  });

  return {
    health: unhealthy ? 'ATTENTION' : stale && lastValidDataAt ? 'STALE' : missing || stale ? 'NO_DATA' : 'CURRENT',
    lastSyncedAt: lastSyncedAt?.toISOString() ?? null,
    lastValidDataAt: lastValidDataAt?.toISOString() ?? null,
    sourceCount: feeds.length,
  };
}
