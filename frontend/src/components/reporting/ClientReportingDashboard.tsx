'use client';

import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/auth-context';
import { clientReportApi, portalApi } from '@/lib/api-client';

interface VerifiedFact {
  label: string;
  value: number;
  unit: string;
  sourceReference: string;
}

interface ClientReport {
  id: string;
  title: string;
  clientName: string;
  reportType: string;
  status: string;
  executiveSummary: string | null;
  recipientEmails: string[];
  metrics: { verifiedFacts?: VerifiedFact[]; asOf?: string | null } | null;
  revision?: number;
  revisions?: Array<{ version: number; snapshot: { title: string; executiveSummary: string; facts: VerifiedFact[]; asOf: string | null }; approvedAt: string }>;
  deliveries?: Array<{ status: string; attemptCount: number; sentAt?: string | null; lastError?: string | null }>;
}

interface ReportStats { total: number; sent: number; draft: number; scheduled: number }
interface PortalChoice { id: string; name: string }
interface ProjectChoice { id: string; name: string; clientName: string }

export default function ClientReportingDashboard() {
  const { user } = useAuth();
  const workspaceId = user?.workspaceId;
  const [reports, setReports] = useState<ClientReport[]>([]);
  const [portalChoices, setPortalChoices] = useState<PortalChoice[]>([]);
  const [projectChoices, setProjectChoices] = useState<ProjectChoice[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [briefingsEnabled, setBriefingsEnabled] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [summaryEdits, setSummaryEdits] = useState<Record<string, string>>({});
  const [consentNotes, setConsentNotes] = useState<Record<string, string>>({});
  const [previews, setPreviews] = useState<Record<string, { version: number; title: string; executiveSummary: string; facts: VerifiedFact[]; asOf: string | null }>>({});
  const [form, setForm] = useState({ title: '', clientName: '', recipientEmails: '', portalId: '', projectId: '' });

  const fetchReports = useCallback(async () => {
    if (!workspaceId) { setLoading(false); return; }
    setError(null);
    try {
      const [reportRows, reportStats, featureState, portalResult, projects] = await Promise.all([
        clientReportApi.getReports(workspaceId),
        clientReportApi.getStats(workspaceId),
        clientReportApi.getBriefingFeatureState(),
        portalApi.getAll(1, 100),
        clientReportApi.getProjectOptions(),
      ]);
      setReports(reportRows as ClientReport[]);
      setStats(reportStats as ReportStats);
      setBriefingsEnabled(featureState.enabled);
      const choices = portalResult.portals.map((portal) => ({ id: portal.id, name: portal.name }));
      setPortalChoices(choices);
      setProjectChoices(projects);
      setForm((current) => {
        const project = projects.find((item) => item.id === current.projectId) ?? projects[0];
        return { ...current, portalId: current.portalId || choices[0]?.id || '', projectId: project?.id || '', clientName: project?.clientName || current.clientName };
      });
    } catch {
      setError('Briefings could not be loaded. Retry to check the latest status.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { void fetchReports(); }, [fetchReports]);

  const createDraft = async () => {
    setBusyId('new');
    try {
      const created = await clientReportApi.createReport({
        title: form.title.trim(),
        clientName: form.clientName.trim(),
        portalId: form.portalId,
        projectId: form.projectId,
        reportType: 'WEEKLY',
        recipientEmails: form.recipientEmails.split(',').map((email) => email.trim()).filter(Boolean),
      });
      if (created?.id) await clientReportApi.generateReport(created.id);
      setForm({ title: '', clientName: form.clientName, recipientEmails: '', portalId: form.portalId, projectId: form.projectId });
      await fetchReports();
    } catch {
      setError('Draft could not be created. Check the fields and retry.');
    } finally { setBusyId(null); }
  };

  const runAction = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try { await action(); await fetchReports(); }
    catch { setError('The briefing update failed. Refresh and retry.'); }
    finally { setBusyId(null); }
  };

  const approve = (report: ClientReport, notifyClient: boolean) => {
    if (notifyClient && !window.confirm(`Send “${report.title}” to the configured client recipients? This cannot be undone.`)) return;
    return runAction(report.id, () => clientReportApi.approve(report.id, {
      notifyClient,
      ...(notifyClient ? { consentNote: consentNotes[report.id]?.trim() } : {}),
    }));
  };

  const preview = async (reportId: string) => {
    setBusyId(reportId);
    setError(null);
    try {
      const result = await clientReportApi.preview(reportId);
      setPreviews((current) => ({ ...current, [reportId]: result }));
    } catch { setError('Preview could not be loaded. Retry to see the current draft.'); }
    finally { setBusyId(null); }
  };

  const download = async (reportId: string, version: number, format: 'pdf' | 'csv') => {
    setBusyId(reportId);
    setError(null);
    try {
      const blob = await clientReportApi.downloadRevision(reportId, version, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `report-${reportId}-v${version}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch { setError('The approved report download failed. Check access and retry.'); }
    finally { setBusyId(null); }
  };

  if (loading) return <div role="status" className="p-8">Loading client briefings…</div>;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Client briefings</h1>
        <p className="text-muted-foreground mt-1">Draft, verify, edit, and approve source-backed updates.</p>
      </div>

      {error && <div role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{error} <Button variant="outline" size="sm" onClick={() => void fetchReports()}>Retry</Button></div>}

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle>Total briefings</CardTitle></CardHeader><CardContent>{stats?.total ?? '—'}</CardContent></Card>
        <Card><CardHeader><CardTitle>Awaiting review</CardTitle></CardHeader><CardContent>{stats?.draft ?? '—'}</CardContent></Card>
        <Card><CardHeader><CardTitle>Sent after approval</CardTitle></CardHeader><CardContent>{stats?.sent ?? '—'}</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>New draft</CardTitle><CardDescription>No message is sent when a draft is created or generated.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input aria-label="Briefing title" placeholder="Briefing title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <Input aria-label="Client name" placeholder="Client name" value={form.clientName} readOnly />
          <Input aria-label="Recipient emails" placeholder="Recipients (comma separated)" value={form.recipientEmails} onChange={(event) => setForm({ ...form, recipientEmails: event.target.value })} />
          <label className="grid gap-1 text-sm">Client portal<select aria-label="Client portal" className="h-10 rounded-md border bg-background px-3" value={form.portalId} onChange={(event) => setForm((current) => ({ ...current, portalId: event.target.value }))}><option value="">Choose a client portal</option>{portalChoices.map((portal) => <option key={portal.id} value={portal.id}>{portal.name}</option>)}</select></label>
          <label className="grid gap-1 text-sm">Reporting project<select aria-label="Reporting project" className="h-10 rounded-md border bg-background px-3" value={form.projectId} onChange={(event) => { const project = projectChoices.find((item) => item.id === event.target.value); setForm((current) => ({ ...current, projectId: event.target.value, clientName: project?.clientName || '' })); }}><option value="">Choose a project</option>{projectChoices.map((project) => <option key={project.id} value={project.id}>{project.name} · {project.clientName}</option>)}</select></label>
          <Button disabled={busyId === 'new' || !form.title.trim() || !form.clientName.trim() || !form.portalId || !form.projectId} onClick={() => void createDraft()}>{busyId === 'new' ? 'Creating…' : 'Create draft'}</Button>
        </CardContent>
      </Card>

      {!briefingsEnabled && <p role="status" className="rounded border p-3 text-sm text-muted-foreground">Briefing approval and client notification are disabled by deployment configuration.</p>}

      <Card>
        <CardHeader><CardTitle>Briefing drafts and history</CardTitle><CardDescription>Numeric facts include their structured source reference. Missing values stay missing.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {!reports.length && <p className="py-8 text-center text-muted-foreground">No briefings yet. Create a draft to get started.</p>}
          {reports.map((report) => {
            const facts = report.metrics?.verifiedFacts ?? [];
            return (
              <article key={report.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><h2 className="font-semibold">{report.title}</h2><p className="text-sm text-muted-foreground">{report.clientName} · {report.reportType}</p></div>
                  <Badge variant="outline">{report.status}</Badge>
                </div>
                {report.status === 'DRAFT' ? (
                  <>
                    <p className="text-xs text-muted-foreground">Keep generated source-backed text, or prefix human-entered statements with “Human note (unverified):”. Numeric claims must match the listed facts.</p>
                    <Textarea aria-label={`Summary for ${report.title}`} value={summaryEdits[report.id] ?? report.executiveSummary ?? ''} onChange={(event) => setSummaryEdits({ ...summaryEdits, [report.id]: event.target.value })} />
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" disabled={busyId === report.id} onClick={() => void preview(report.id)}>Preview exact content</Button>
                      <Button variant="outline" disabled={busyId === report.id} onClick={() => void runAction(report.id, () => clientReportApi.updateReport(report.id, { executiveSummary: summaryEdits[report.id] ?? report.executiveSummary ?? '' }))}>Save edits</Button>
                      <Button variant="outline" disabled={busyId === report.id} onClick={() => void runAction(report.id, () => clientReportApi.generateReport(report.id))}>Refresh verified facts</Button>
                      <Button disabled={!briefingsEnabled || busyId === report.id} onClick={() => void approve(report, false)}>Approve without notifying</Button>
                    </div>
                    {previews[report.id] && <section aria-label={`Preview for ${report.title}`} className="rounded border bg-muted/30 p-3"><h3 className="font-medium">Preview · revision {previews[report.id].version}</h3><p>{previews[report.id].executiveSummary}</p><ul className="list-disc pl-5">{previews[report.id].facts.map((fact, index) => <li key={`${fact.sourceReference}-${index}`}>{fact.label}: {fact.value} {fact.unit} · {fact.sourceReference}</li>)}{!previews[report.id].facts.length && <li>Not enough verified data</li>}</ul><p className="text-xs text-muted-foreground">Data as of: {previews[report.id].asOf ?? 'Not available'}</p></section>}
                    <div className="space-y-2 border-t pt-3">
                      <p className="text-xs text-muted-foreground">Notification targets: {report.recipientEmails.length ? report.recipientEmails.join(', ') : 'none configured'}</p>
                      <Input aria-label={`Notification consent note for ${report.title}`} placeholder="Consent note required to notify client" value={consentNotes[report.id] ?? ''} onChange={(event) => setConsentNotes({ ...consentNotes, [report.id]: event.target.value })} />
                      <Button variant="destructive" disabled={!briefingsEnabled || busyId === report.id || !report.recipientEmails.length || (consentNotes[report.id]?.trim().length ?? 0) < 8} onClick={() => void approve(report, true)}>Approve and notify client</Button>
                    </div>
                  </>
                ) : <p>{report.executiveSummary || 'Not enough verified data to report an outcome.'}</p>}
                {(report.status === 'SENT' || report.status === 'APPROVED') && <Button variant="outline" disabled={busyId === report.id} onClick={() => void runAction(report.id, () => clientReportApi.revise(report.id))}>Create revision</Button>}
                {report.revisions?.map((revision) => <section key={revision.version} className="flex flex-wrap items-center gap-2 border-t pt-3" aria-label={`Approved revision ${revision.version}`}><span className="text-sm">Approved revision {revision.version} · {new Date(revision.approvedAt).toLocaleString()}</span><Button variant="outline" size="sm" disabled={busyId === report.id} onClick={() => void download(report.id, revision.version, 'pdf')}>Download PDF</Button><Button variant="outline" size="sm" disabled={busyId === report.id} onClick={() => void download(report.id, revision.version, 'csv')}>Download CSV</Button></section>)}
                {report.deliveries?.[0] && <p role="status" className="text-sm">Delivery: {report.deliveries[0].status.toLowerCase()} · attempts {report.deliveries[0].attemptCount}{report.deliveries[0].sentAt ? ` · delivered ${new Date(report.deliveries[0].sentAt).toLocaleString()}` : ''}{report.deliveries[0].lastError ? ` · ${report.deliveries[0].lastError}` : ''}{report.deliveries[0].status === 'FAILED' && <Button variant="outline" size="sm" className="ml-2" disabled={busyId === report.id} onClick={() => void runAction(report.id, () => clientReportApi.retryDelivery(report.id))}>Retry delivery</Button>}</p>}
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {facts.map((fact, index) => <li key={`${fact.sourceReference}-${index}`}><strong>{fact.label}:</strong> {fact.value} {fact.unit} <span className="text-muted-foreground">· {fact.sourceReference}</span></li>)}
                  {!facts.length && <li>Not enough verified data</li>}
                </ul>
                {report.metrics?.asOf && <time className="block text-xs text-muted-foreground" dateTime={report.metrics.asOf}>Source calculated {new Date(report.metrics.asOf).toLocaleString()}</time>}
              </article>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
