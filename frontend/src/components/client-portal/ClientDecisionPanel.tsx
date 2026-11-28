'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import {
  decisionInboxApi,
  type ClientDecisionRecord,
  type DecisionResponseKind,
} from '@/lib/enterprise-api';

interface ClientDecisionPanelProps {
  token: string;
  password?: string;
}

function responseLabel(value: DecisionResponseKind) {
  return {
    APPROVE: 'Approved',
    DECLINE: 'Declined',
    REQUEST_CHANGES: 'Requested changes',
  }[value];
}

export function ClientDecisionPanel({ token, password }: ClientDecisionPanelProps) {
  const [decisions, setDecisions] = useState<ClientDecisionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const result = await decisionInboxApi.listForClient(token, password);
      setDecisions(result.decisions);
    } catch (reason) {
      const status = (reason as { response?: { status?: number } }).response?.status;
      setError(status === 401 || status === 403
        ? 'Sign in with the client account assigned to this link to view or respond to decisions.'
        : 'Decision requests could not be loaded. Check the link and retry.');
    } finally {
      setLoading(false);
    }
  }, [password, token]);

  useEffect(() => { void load(); }, [load]);

  const respond = async (decision: ClientDecisionRecord, response: DecisionResponseKind) => {
    setBusyId(decision.id);
    setError('');
    try {
      await decisionInboxApi.respond(token, decision.id, {
        password,
        expectedRevision: decision.portalRevision,
        response,
        comment: comments[decision.id]?.trim() || undefined,
      });
      setLoading(true);
      await load();
    } catch (reason) {
      const status = (reason as { response?: { status?: number } }).response?.status;
      setError(status === 409
        ? 'This portal version changed or the request was already answered. Refresh to see the current decision.'
        : 'Your response could not be saved. Check access and retry.');
      setLoading(true);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section aria-labelledby="client-decisions-heading" className="mt-8 space-y-4 border-t pt-6">
      <header>
        <h2 id="client-decisions-heading" className="text-xl font-semibold">Decisions for your review</h2>
        <p className="mt-1 text-sm text-slate-600">Your response is saved with the exact published portal revision shown below.</p>
      </header>
      {loading ? <p role="status" aria-live="polite" aria-busy="true">Loading decision requests…</p> : null}
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{busyId ? 'Saving your response' : ''}</p>
      {error && <div role="alert" className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-950"><p>{error}</p><Link className="mt-2 inline-block underline" href={`/auth/login?returnTo=${encodeURIComponent(`/share/${token}`)}`}>Sign in to continue</Link><button type="button" className="ml-4 underline" onClick={() => { setLoading(true); setError(''); void load(); }}>Retry</button></div>}
      {!loading && !error && decisions.length === 0 && <p className="rounded border p-4 text-sm text-slate-600">No decision requests are open for this assigned link.</p>}
      {decisions.map((decision) => (
        <article key={decision.id} className="space-y-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-semibold">{decision.title}</h3>
            <span className="rounded border px-2 py-1 text-xs">{decision.status.replaceAll('_', ' ')}</span>
          </div>
          <p>{decision.prompt}</p>
          <p className="text-sm text-slate-600">Applies to published portal revision {decision.portalRevision}{decision.dueAt ? ` · Response requested by ${new Date(decision.dueAt).toLocaleString()}` : ''}</p>
          {decision.status === 'OPEN' && decision.canRespond === false && <p role="status" className="rounded bg-amber-50 p-3 text-sm text-amber-950">The portal has changed since this request was issued. Ask the agency to create a new request for the current revision.</p>}
          {decision.response && <div className="rounded bg-slate-50 p-3"><p><strong>Your saved response:</strong> {responseLabel(decision.response.response)} · revision {decision.response.portalRevision}</p>{decision.response.comment && <p className="mt-1">{decision.response.comment}</p>}<time className="mt-1 block text-xs text-slate-500" dateTime={decision.response.createdAt}>{new Date(decision.response.createdAt).toLocaleString()}</time></div>}
          {decision.status === 'OPEN' && decision.canRespond !== false && (
            <>
              <label className="block text-sm">Optional comment<textarea aria-label={`Comment for ${decision.title}`} maxLength={2000} value={comments[decision.id] ?? ''} onChange={(event) => setComments((current) => ({ ...current, [decision.id]: event.target.value }))} className="mt-1 block w-full rounded border p-2" /></label>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busyId === decision.id} onClick={() => void respond(decision, 'APPROVE')} className="min-h-11 rounded bg-emerald-700 px-3 py-2 text-white disabled:opacity-50">{busyId === decision.id ? 'Saving…' : 'Approve this version'}</button>
                <button type="button" disabled={busyId === decision.id} onClick={() => void respond(decision, 'REQUEST_CHANGES')} className="min-h-11 rounded border px-3 py-2 disabled:opacity-50">Request changes</button>
                <button type="button" disabled={busyId === decision.id} onClick={() => void respond(decision, 'DECLINE')} className="min-h-11 rounded border border-red-300 px-3 py-2 text-red-800 disabled:opacity-50">Decline</button>
              </div>
            </>
          )}
          <details className="text-sm"><summary className="cursor-pointer">Request timeline</summary><ol className="mt-2 space-y-2">{decision.timeline.map((event) => <li key={event.eventId} className="border-l-2 pl-3"><span className="font-medium">{event.eventType.replaceAll('_', ' ')}</span><span className="ml-2 text-xs text-slate-500">Portal revision {event.revision}</span><time className="ml-2 text-xs text-slate-500" dateTime={event.serverTimestamp}>{new Date(event.serverTimestamp).toLocaleString()}</time></li>)}</ol></details>
        </article>
      ))}
    </section>
  );
}
