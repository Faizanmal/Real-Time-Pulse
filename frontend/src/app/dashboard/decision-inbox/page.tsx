'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { decisionInboxApi, shareLinksApi, type ClientDecisionRecord, type DecisionEscalationPolicy, type ShareLink } from '@/lib/enterprise-api';

const DEFAULT_POLICY: DecisionEscalationPolicy = {
  workspaceId: '',
  enabled: false,
  notificationOptIn: false,
  timeZone: 'UTC',
  businessDays: [1, 2, 3, 4, 5],
  businessHoursStart: '09:00',
  businessHoursEnd: '17:00',
  reminderIntervalMinutes: 1440,
  maxReminders: 3,
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function DecisionInboxPage() {
  const [decisions, setDecisions] = useState<ClientDecisionRecord[]>([]);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [policy, setPolicy] = useState<DecisionEscalationPolicy>(DEFAULT_POLICY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ target: '', title: '', prompt: '', dueAt: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rows, shareLinks, escalationPolicy] = await Promise.all([
        decisionInboxApi.list(),
        shareLinksApi.getAll(),
        decisionInboxApi.getPolicy(),
      ]);
      setDecisions(rows);
      setLinks(shareLinks);
      setPolicy(escalationPolicy);
    } catch (reason) {
      const status = (reason as { response?: { status?: number } }).response?.status;
      setError(status === 403
        ? 'Only workspace owners and admins can manage the decision inbox.'
        : 'Decision inbox could not be loaded. Retry to check current status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const targets = useMemo(() => links.flatMap((link) =>
    link.allowDecisions && link.isActive && (!link.expiresAt || new Date(link.expiresAt) > new Date())
      ? (link.assignments ?? []).map((assignment) => ({
          value: `${link.id}|${assignment.userId}`,
          linkId: link.id,
          userId: assignment.userId,
          label: `${link.portal?.name ?? 'Client portal'} — ${assignment.user.email}`,
        }))
      : [],
  ), [links]);

  const createDecision = async (event: FormEvent) => {
    event.preventDefault();
    const target = targets.find((candidate) => candidate.value === form.target);
    if (!target) {
      setError('Select an active decision-enabled link assigned to a client account.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await decisionInboxApi.create({
        sourceShareLinkId: target.linkId,
        clientUserId: target.userId,
        title: form.title.trim(),
        prompt: form.prompt.trim(),
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
      });
      setForm({ target: '', title: '', prompt: '', dueAt: '' });
      setNotice('Decision request created for the selected published revision.');
      await load();
    } catch (reason) {
      const status = (reason as { response?: { status?: number } }).response?.status;
      setError(status === 409
        ? 'The portal must be published and the share link must still be active before creating a decision.'
        : 'Decision request could not be created. Verify the client assignment and retry.');
    } finally {
      setSaving(false);
    }
  };

  const savePolicy = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const saved = await decisionInboxApi.updatePolicy(policy);
      setPolicy(saved);
      setNotice('Escalation policy saved. Notifications remain off unless both switches are enabled.');
    } catch {
      setError('Policy was not saved. Check the IANA timezone, business-hour range, and notification opt-in.');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: number) => setPolicy((current) => ({
    ...current,
    businessDays: current.businessDays.includes(day)
      ? current.businessDays.filter((value) => value !== day)
      : [...current.businessDays, day].sort(),
  }));

  const withdraw = async (decision: ClientDecisionRecord) => {
    setSaving(true);
    setError('');
    try {
      await decisionInboxApi.withdraw(decision.id);
      setNotice('Open request withdrawn. Its timeline entry is preserved.');
      await load();
    } catch {
      setError('The request could not be withdrawn. It may already have a client response.');
    } finally {
      setSaving(false);
    }
  };

  const openCount = decisions.filter((decision) => decision.status === 'OPEN' && !decision.isStale).length;
  const answeredCount = decisions.filter((decision) => decision.response).length;
  const staleCount = decisions.filter((decision) => decision.isStale).length;

  return (
    <main className="mx-auto max-w-6xl space-y-7 p-6">
      <header><h1 className="text-3xl font-bold">Decision inbox</h1><p className="mt-2 text-slate-600">Request a response to a published client portal revision and keep the immutable response with its timeline.</p></header>
      {error && <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-900">{error} <button type="button" className="ml-2 underline" onClick={() => void load()}>Retry</button></p>}
      {notice && <p role="status" className="rounded border border-green-300 bg-green-50 p-3 text-green-900">{notice}</p>}
      {loading ? <p role="status" aria-busy="true">Loading decision inbox…</p> : <>
        <section aria-label="Decision inbox summary" className="grid gap-3 sm:grid-cols-3">
          <div className="rounded border bg-white p-4"><p className="text-sm text-slate-500">Open and current</p><p className="text-2xl font-semibold">{openCount}</p></div>
          <div className="rounded border bg-white p-4"><p className="text-sm text-slate-500">Client responses</p><p className="text-2xl font-semibold">{answeredCount}</p></div>
          <div className="rounded border bg-white p-4"><p className="text-sm text-slate-500">Needs new acknowledgment</p><p className="text-2xl font-semibold">{staleCount}</p></div>
        </section>

        <form onSubmit={createDecision} className="space-y-4 rounded-xl border bg-white p-5">
          <div><h2 className="text-xl font-semibold">Request a client decision</h2><p className="mt-1 text-sm text-slate-600">Only active links explicitly enabled for decisions and assigned to a client account are eligible.</p></div>
          {targets.length === 0 ? <p className="rounded bg-amber-50 p-3 text-sm text-amber-950">No eligible links. Create an active share link, assign a client account and enable decision replies in Share Links.</p> : <label className="block text-sm">Client and portal<select required value={form.target} onChange={(event) => setForm((current) => ({ ...current, target: event.target.value }))} className="mt-1 block w-full rounded border p-2"><option value="">Choose a client link</option>{targets.map((target) => <option key={target.value} value={target.value}>{target.label}</option>)}</select></label>}
          <label className="block text-sm">Decision title<input required maxLength={160} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="mt-1 block w-full rounded border p-2" /></label>
          <label className="block text-sm">What should the client decide?<textarea required maxLength={4000} value={form.prompt} onChange={(event) => setForm((current) => ({ ...current, prompt: event.target.value }))} className="mt-1 block w-full rounded border p-2" /></label>
          <label className="block text-sm">Requested by (optional)<input type="datetime-local" value={form.dueAt} onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))} className="mt-1 block rounded border p-2" /></label>
          <button disabled={saving || targets.length === 0} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{saving ? 'Saving…' : 'Create decision request'}</button>
        </form>

        <form onSubmit={savePolicy} className="space-y-4 rounded-xl border bg-white p-5">
          <div><h2 className="text-xl font-semibold">Escalation and reminder policy</h2><p className="mt-1 text-sm text-slate-600">Reminders are persisted in-app notifications, suppressed outside local business hours and capped by interval and maximum count. No email, SMS or external notification is sent.</p></div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={policy.notificationOptIn} onChange={(event) => setPolicy((current) => ({ ...current, notificationOptIn: event.target.checked, ...(event.target.checked ? {} : { enabled: false }) }))} />I opt in to in-app decision reminders for assigned clients</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={policy.enabled} disabled={!policy.notificationOptIn} onChange={(event) => setPolicy((current) => ({ ...current, enabled: event.target.checked }))} />Enable the escalation schedule</label>
          <label className="block text-sm">IANA timezone<input required maxLength={80} value={policy.timeZone} onChange={(event) => setPolicy((current) => ({ ...current, timeZone: event.target.value }))} placeholder="America/New_York" className="mt-1 block w-full rounded border p-2" /></label>
          <fieldset><legend className="text-sm font-medium">Business days</legend><div className="mt-2 flex flex-wrap gap-3">{WEEKDAYS.map((day, index) => <label key={day} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={policy.businessDays.includes(index)} onChange={() => toggleDay(index)} />{day.slice(0, 3)}</label>)}</div></fieldset>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Business hours start<input type="time" required value={policy.businessHoursStart} onChange={(event) => setPolicy((current) => ({ ...current, businessHoursStart: event.target.value }))} className="mt-1 block rounded border p-2" /></label><label className="text-sm">Business hours end<input type="time" required value={policy.businessHoursEnd} onChange={(event) => setPolicy((current) => ({ ...current, businessHoursEnd: event.target.value }))} className="mt-1 block rounded border p-2" /></label><label className="text-sm">Minimum minutes between reminders<input type="number" min={15} max={10080} value={policy.reminderIntervalMinutes} onChange={(event) => setPolicy((current) => ({ ...current, reminderIntervalMinutes: Number(event.target.value) }))} className="mt-1 block rounded border p-2" /></label><label className="text-sm">Maximum reminders per request<input type="number" min={1} max={10} value={policy.maxReminders} onChange={(event) => setPolicy((current) => ({ ...current, maxReminders: Number(event.target.value) }))} className="mt-1 block rounded border p-2" /></label></div>
          <button disabled={saving || (policy.enabled && !policy.notificationOptIn)} className="rounded border px-4 py-2 disabled:opacity-50">Save escalation policy</button>
        </form>

        <section className="space-y-3" aria-labelledby="decision-requests-heading">
          <h2 id="decision-requests-heading" className="text-xl font-semibold">Requests and immutable responses</h2>
          {decisions.length === 0 ? <p className="rounded border p-5 text-slate-600">No decision requests yet.</p> : decisions.map((decision) => (
            <article key={decision.id} className="space-y-3 rounded-xl border bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{decision.title}</h3><p className="text-sm text-slate-600">{decision.clientEmail ?? 'Assigned client'} · {decision.status.replaceAll('_', ' ')}</p></div>{decision.status === 'OPEN' && !decision.isStale && <button type="button" disabled={saving} onClick={() => void withdraw(decision)} className="rounded border px-3 py-1">Withdraw</button>}</div>
              <p>{decision.prompt}</p>
              <p className="text-xs text-slate-500">Published revision {decision.portalRevision}{decision.currentPortalRevision !== decision.portalRevision ? ` · Current revision ${decision.currentPortalRevision ?? 'unavailable'}; new acknowledgment required` : ''}{decision.dueAt ? ` · Due ${new Date(decision.dueAt).toLocaleString()}` : ''}</p>
              {decision.response && <div className="rounded bg-emerald-50 p-3"><p className="font-medium">Immutable client response: {decision.response.response.replaceAll('_', ' ')}</p><p className="text-sm">{decision.response.comment || 'No comment provided.'}</p><p className="mt-1 text-xs">Response records portal revision {decision.response.portalRevision}</p><time className="mt-1 block text-xs" dateTime={decision.response.createdAt}>{new Date(decision.response.createdAt).toLocaleString()}</time></div>}
              <details><summary className="cursor-pointer text-sm">Timeline ({decision.timeline.length})</summary><ol className="mt-2 space-y-2">{decision.timeline.map((event) => <li key={event.eventId} className="border-l-2 pl-3"><span>{event.eventType.replaceAll('_', ' ')}</span><span className="ml-2 text-xs text-slate-500">Portal revision {event.revision}</span><time className="ml-2 text-xs text-slate-500" dateTime={event.serverTimestamp}>{new Date(event.serverTimestamp).toLocaleString()}</time></li>)}</ol></details>
            </article>
          ))}
        </section>
      </>}
    </main>
  );
}
