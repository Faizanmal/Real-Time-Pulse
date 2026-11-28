import type { ReactNode } from 'react';

export interface ClientFeedStatus {
  health: 'CURRENT' | 'STALE' | 'ATTENTION' | 'NO_DATA';
  lastSyncedAt: string | null;
  lastValidDataAt: string | null;
  sourceCount: number;
}

interface ClientPortalSummaryProps {
  status: string | null;
  statusNote: string | null;
  latestDeliverable: string | null;
  pendingDecision: string | null;
  updatedAt: string | null;
  feedStatus: ClientFeedStatus | null | undefined;
}

function readableStatus(value: string | null) {
  if (!value) return 'Not reported';
  return value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function timeLabel(value: string | null | undefined): ReactNode {
  if (!value) return 'No successful sync recorded';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Timestamp unavailable';
  return <time dateTime={date.toISOString()}>{date.toLocaleString()}</time>;
}

export function ClientPortalSummary({ status, statusNote, latestDeliverable, pendingDecision, updatedAt, feedStatus }: ClientPortalSummaryProps) {
  const health = feedStatus?.health ?? 'NO_DATA';
  const healthText = {
    CURRENT: 'Sources up to date',
    STALE: 'Source data may be stale',
    ATTENTION: 'Source needs attention',
    NO_DATA: 'No source data yet',
  }[health];

  return (
    <section role="region" aria-labelledby="client-status-heading" className="mb-6 rounded-xl border bg-white p-4 shadow-sm sm:p-5">
      <h2 id="client-status-heading" className="text-lg font-semibold">Client status</h2>
      <p className="mt-2 flex flex-wrap items-center gap-2" role={health === 'STALE' || health === 'ATTENTION' ? 'alert' : 'status'}>
        <span className={`rounded-full px-2.5 py-1 text-sm font-medium ${health === 'CURRENT' ? 'bg-green-100 text-green-900' : health === 'NO_DATA' ? 'bg-slate-100 text-slate-800' : 'bg-amber-100 text-amber-950'}`}>
          {healthText}
        </span>
        {feedStatus?.sourceCount ? <span className="text-sm text-slate-600">{feedStatus.sourceCount} source{feedStatus.sourceCount === 1 ? '' : 's'}</span> : null}
      </p>
      {health === 'STALE' && <p className="mt-2 text-sm text-amber-900">Some values may be old. Check the last sync time before making a decision.</p>}
      {health === 'ATTENTION' && <p className="mt-2 text-sm text-amber-900">At least one connected source needs attention. The portal does not replace missing values with zero.</p>}
      {health === 'NO_DATA' && <p className="mt-2 text-sm text-slate-600">No successful source data is available yet. Ask your agency contact if you expected an update.</p>}

      <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</dt><dd className="mt-1 font-medium">{readableStatus(status)}</dd>{statusNote && <dd className="mt-1 text-sm text-slate-600">{statusNote}</dd>}</div>
        <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Last sync</dt><dd className="mt-1 text-sm">{timeLabel(feedStatus?.lastSyncedAt)}</dd></div>
        <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Latest deliverable</dt><dd className="mt-1 text-sm">{latestDeliverable?.trim() || 'No deliverable shared yet'}</dd></div>
        <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Pending decision</dt><dd className="mt-1 text-sm">{pendingDecision?.trim() || 'No pending decision recorded'}</dd></div>
        <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Client update</dt><dd className="mt-1 text-sm">{updatedAt ? timeLabel(updatedAt) : 'No status update recorded'}</dd></div>
      </dl>
    </section>
  );
}
