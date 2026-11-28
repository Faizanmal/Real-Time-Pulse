'use client';

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { clientReportApi } from '@/lib/api-client';

interface SharedReport {
  version: number;
  title: string;
  reportType: string;
  executiveSummary: string;
  facts: Array<{ label: string; value: number; unit: string; sourceReference: string }>;
  asOf: string | null;
  approvedAt: string;
  deliveredAt: string | null;
}

export function SharedClientReportsPanel({ token, password }: { token: string; password?: string }) {
  const [reports, setReports] = useState<SharedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setReports(await clientReportApi.listSharedReports(token, password) as SharedReport[]); }
    catch { setError('Reports are unavailable for this client account.'); }
    finally { setLoading(false); }
  }, [password, token]);
  useEffect(() => { void load(); }, [load]);

  return <section aria-labelledby="shared-reports-heading" className="mt-6 rounded-lg border bg-background p-5">
    <h2 id="shared-reports-heading" className="text-xl font-semibold">Delivered reports</h2>
    {loading && <p role="status" className="py-4">Loading reports…</p>}
    {error && <div role="alert" className="py-3 text-red-700">{error} <Button variant="outline" size="sm" onClick={() => void load()}>Retry</Button></div>}
    {!loading && !error && !reports.length && <p className="py-4 text-muted-foreground">No delivered reports yet.</p>}
    <div className="space-y-4">
      {reports.map((report) => <article key={`${report.version}-${report.approvedAt}`} className="border-t pt-4">
        <h3 className="font-semibold">{report.title}</h3>
        <p className="text-sm text-muted-foreground">{report.reportType} · revision {report.version}</p>
        <p className="my-2">{report.executiveSummary}</p>
        <ul className="list-disc space-y-1 pl-5 text-sm">{report.facts.map((fact) => <li key={`${fact.sourceReference}-${fact.label}`}><strong>{fact.label}:</strong> {fact.value} {fact.unit} <span className="text-muted-foreground">· Source: {fact.sourceReference}</span></li>)}{!report.facts.length && <li>Not enough verified data</li>}</ul>
        <p className="mt-3 text-xs text-muted-foreground">Data as of: {report.asOf ? new Date(report.asOf).toLocaleString() : 'Not available'} · Delivered: {report.deliveredAt ? new Date(report.deliveredAt).toLocaleString() : 'Not available'}</p>
      </article>)}
    </div>
  </section>;
}
