export interface RiskFeedInput {
  source: string;
  connectionState?: string | null;
  connectorStatus?: string | null;
  lastValidDataAt?: Date | string | null;
  health?: string | null;
}

export interface RiskDriver {
  code:
    | 'CONNECTOR_EXPIRED'
    | 'CONNECTOR_UNHEALTHY'
    | 'SOURCE_MISSING'
    | 'SOURCE_STALE'
    | 'SOURCES_CONFLICT'
    | 'STATUS_CONTRADICTION';
  title: string;
  evidence: string;
}

export interface ClientConfidenceRisk {
  level: 'LOW' | 'ELEVATED' | 'HIGH';
  drivers: RiskDriver[];
  evaluatedAt: string;
  ruleVersion: string;
}

export const CLIENT_RISK_RULE_VERSION = 'client-confidence-v1';
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export function evaluateClientConfidenceRisk(input: {
  feeds: RiskFeedInput[];
  clientStatus?: string | null;
  now?: Date;
}): ClientConfidenceRisk {
  const now = input.now ?? new Date();
  const drivers: RiskDriver[] = [];
  const feeds = input.feeds;
  const expired = feeds.filter(
    (feed) => feed.connectorStatus === 'EXPIRED' || feed.connectionState === 'NEEDS_RECONNECT',
  );
  const disconnected = feeds.filter(
    (feed) => feed.connectionState === 'DISCONNECTED' || feed.connectionState === 'DEGRADED',
  );
  if (expired.length)
    drivers.push({
      code: 'CONNECTOR_EXPIRED',
      title: 'Connector expired',
      evidence: expired.map((feed) => feed.source).join(', ') + ' requires reconnection.',
    });
  if (disconnected.length)
    drivers.push({
      code: 'CONNECTOR_UNHEALTHY',
      title: 'Connector is unhealthy',
      evidence:
        disconnected.map((feed) => `${feed.source} (${feed.connectionState})`).join(', ') +
        ' is not connected and healthy.',
    });

  const missing = feeds.filter((feed) => !feed.lastValidDataAt && feed.health !== 'CURRENT');
  if (!feeds.length || missing.length)
    drivers.push({
      code: 'SOURCE_MISSING',
      title: 'Source data is missing',
      evidence: !feeds.length
        ? 'No connected sources are configured.'
        : `${missing.map((feed) => feed.source).join(', ')} has no valid observation timestamp.`,
    });

  const stale = feeds.filter((feed) => {
    if (feed.health === 'STALE') return true;
    if (!feed.lastValidDataAt) return false;
    const date =
      feed.lastValidDataAt instanceof Date ? feed.lastValidDataAt : new Date(feed.lastValidDataAt);
    return !Number.isFinite(date.getTime()) || now.getTime() - date.getTime() > STALE_AFTER_MS;
  });
  if (stale.length)
    drivers.push({
      code: 'SOURCE_STALE',
      title: 'Source data is stale',
      evidence:
        stale.map((feed) => feed.source).join(', ') +
        ' has not supplied valid data within 24 hours.',
    });

  const healthStates = new Set(feeds.map((feed) => feed.health).filter(Boolean));
  if (
    healthStates.has('CURRENT') &&
    [...healthStates].some((state) => ['DEGRADED', 'MISSING', 'NO_DATA', 'STALE'].includes(state))
  ) {
    drivers.push({
      code: 'SOURCES_CONFLICT',
      title: 'Sources disagree on health',
      evidence: `Visible sources report ${[...healthStates].join(' and ')}.`,
    });
  }

  const status = input.clientStatus?.toUpperCase();
  const hasUnhealthyFeed =
    stale.length > 0 ||
    feeds.some(
      (feed) =>
        feed.health === 'STALE' ||
        feed.health === 'DEGRADED' ||
        feed.health === 'MISSING' ||
        feed.health === 'NO_DATA' ||
        ['NEEDS_RECONNECT', 'DISCONNECTED', 'DEGRADED'].includes(feed.connectionState ?? '') ||
        feed.connectorStatus === 'EXPIRED',
    );
  if ((status === 'ON_TRACK' || status === 'COMPLETED') && hasUnhealthyFeed)
    drivers.push({
      code: 'STATUS_CONTRADICTION',
      title: 'Client status conflicts with source health',
      evidence: `Client status is ${status}, while at least one visible source is stale, missing, degraded, or disconnected.`,
    });

  const severity = drivers.length;
  return {
    level: severity >= 3 ? 'HIGH' : severity > 0 ? 'ELEVATED' : 'LOW',
    drivers: drivers.slice(0, 3),
    evaluatedAt: now.toISOString(),
    ruleVersion: CLIENT_RISK_RULE_VERSION,
  };
}

export function binaryClassificationMetrics(
  cases: Array<{ expectedRisk: boolean; detectedRisk: boolean }>,
) {
  const tp = cases.filter((item) => item.expectedRisk && item.detectedRisk).length;
  const fp = cases.filter((item) => !item.expectedRisk && item.detectedRisk).length;
  const fn = cases.filter((item) => item.expectedRisk && !item.detectedRisk).length;
  const tn = cases.filter((item) => !item.expectedRisk && !item.detectedRisk).length;
  return {
    truePositive: tp,
    falsePositive: fp,
    falseNegative: fn,
    trueNegative: tn,
    precision: tp + fp ? tp / (tp + fp) : null,
    recall: tp + fn ? tp / (tp + fn) : null,
  };
}
