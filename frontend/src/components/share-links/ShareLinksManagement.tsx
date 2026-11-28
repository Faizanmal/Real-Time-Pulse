'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

import { shareLinksApi, type ShareLink, type ShareAccessRequest, type CreateShareLinkDto } from '@/lib/enterprise-api';

export default function ShareLinksManagement() {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [requests, setRequests] = useState<ShareAccessRequest[]>([]);
  const [guestComments, setGuestComments] = useState<Record<string, Array<{ id: string; displayName: string; content: string; createdAt: string }>>>({});
  const [commentsOpen, setCommentsOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [portalId, setPortalId] = useState('');
  const [password, setPassword] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [maxViews, setMaxViews] = useState('');
  const [allowExport, setAllowExport] = useState(false);
  const [allowComments, setAllowComments] = useState(false);
  const [allowDecisions, setAllowDecisions] = useState(false);
  const [clientUserIds, setClientUserIds] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [loadedLinks, loadedRequests] = await Promise.all([shareLinksApi.getAll(), shareLinksApi.getAccessRequests()]);
      setLinks(loadedLinks);
      setRequests(loadedRequests);
    } catch {
      setError('Share links could not be loaded. Retry or contact your workspace administrator.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const dto: CreateShareLinkDto = {
        portalId: portalId.trim(),
        password: password || undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        maxViews: maxViews ? Number(maxViews) : undefined,
        allowExport,
        allowComments,
        allowDecisions,
        clientUserIds: clientUserIds.split(',').map((id) => id.trim()).filter(Boolean),
      };
      const result = await shareLinksApi.create(dto);
      setLinks((current) => [result, ...current]);
      await navigator.clipboard.writeText(result.shareUrl);
      setPortalId(''); setPassword(''); setExpiresAt(''); setMaxViews(''); setClientUserIds('');
      setAllowExport(false); setAllowComments(false); setAllowDecisions(false);
    } catch {
      setError('The link was not created. Check that the portal belongs to your workspace and try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (link: ShareLink) => {
    try {
      const updated = await shareLinksApi.update(link.id, { isActive: !link.isActive });
      setLinks((current) => current.map((item) => item.id === link.id ? updated : item));
    } catch {
      setError('The link status could not be changed.');
    }
  };

  const revoke = async (link: ShareLink) => {
    if (!window.confirm('Revoke this link? Anyone with its URL will lose access.')) return;
    try {
      await shareLinksApi.delete(link.id);
      setLinks((current) => current.filter((item) => item.id !== link.id));
    } catch {
      setError('The link could not be revoked.');
    }
  };

  const rotate = async (link: ShareLink) => {
    try {
      const rotated = await shareLinksApi.regenerate(link.id);
      const url = rotated.shareUrl;
      setLinks((current) => current.map((item) => item.id === link.id ? { ...item, token: rotated.token, currentViews: 0 } : item));
      await navigator.clipboard.writeText(url);
    } catch {
      setError('The link could not be rotated.');
    }
  };

  const reviewRequest = async (request: ShareAccessRequest) => {
    try { await shareLinksApi.reviewAccessRequest(request.id); setRequests((items) => items.map((item) => item.id === request.id ? { ...item, status: 'REVIEWED' } : item)); }
    catch { setError('The access request could not be marked reviewed.'); }
  };

  const toggleComments = async (link: ShareLink) => {
    if (commentsOpen === link.id) { setCommentsOpen(null); return; }
    try { const loaded = await shareLinksApi.getManagedComments(link.id); setGuestComments((items) => ({ ...items, [link.id]: loaded })); setCommentsOpen(link.id); }
    catch { setError('Comments could not be loaded for this share link.'); }
  };

  const toggleDecisionReplies = async (link: ShareLink) => {
    try {
      const updated = await shareLinksApi.update(link.id, { allowDecisions: !link.allowDecisions });
      setLinks((current) => current.map((item) => item.id === link.id ? updated : item));
    } catch {
      setError('Decision reply access could not be changed.');
    }
  };

  const deleteGuestComment = async (linkId: string, commentId: string) => {
    try { await shareLinksApi.deleteManagedComment(linkId, commentId); setGuestComments((items) => ({ ...items, [linkId]: (items[linkId] || []).filter((comment) => comment.id !== commentId) })); }
    catch { setError('The comment could not be removed.'); }
  };

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <header>
        <h1 className="text-3xl font-bold">Share links</h1>
        <p className="mt-2 text-slate-600">Create unlisted portal links with optional password, expiry, and view limits.</p>
      </header>
      <form onSubmit={create} className="grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-2">
        <label className="text-sm">Portal ID<input className="mt-1 block w-full rounded border p-2" value={portalId} onChange={(event) => setPortalId(event.target.value)} required /></label>
        <label className="text-sm">Password (optional)<input className="mt-1 block w-full rounded border p-2" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <label className="text-sm">Expires at (optional)<input className="mt-1 block w-full rounded border p-2" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label>
        <label className="text-sm">Maximum views (optional)<input className="mt-1 block w-full rounded border p-2" type="number" min="1" value={maxViews} onChange={(event) => setMaxViews(event.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allowExport} onChange={(event) => setAllowExport(event.target.checked)} />Allow export</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allowComments} onChange={(event) => setAllowComments(event.target.checked)} />Allow comments</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allowDecisions} onChange={(event) => setAllowDecisions(event.target.checked)} />Allow assigned clients to respond to decisions</label>
        <label className="text-sm md:col-span-2">Client account user IDs (comma separated; leave blank for bearer link)<input className="mt-1 block w-full rounded border p-2" value={clientUserIds} onChange={(event) => setClientUserIds(event.target.value)} placeholder="00000000-0000-4000-8000-000000000012" /></label>
        <button className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50 md:col-span-2" disabled={saving}>{saving ? 'Creating…' : 'Create and copy link'}</button>
      </form>
      {error && <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{error} <button className="ml-2 underline" onClick={() => void load()}>Reload</button></p>}
      {loading ? <p role="status" aria-busy="true">Loading share links…</p> : links.length === 0 ? <p className="rounded border p-5 text-slate-600">No share links yet.</p> : (
        <ul className="space-y-3">{links.map((link) => (
          <li key={link.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
            <div>
              <h2 className="font-semibold">{link.portal?.name || `Portal ${link.portalId}`}</h2>
              <p className="text-sm text-slate-600">{link.currentViews}{link.maxViews ? ` / ${link.maxViews}` : ''} views · {link.hasPassword ? 'Password protected' : 'No password'} · {link.expiresAt ? `Expires ${new Date(link.expiresAt).toLocaleString()}` : 'No expiry'}</p>
              <p className="mt-1 text-xs text-slate-500">{link.allowExport ? 'Export allowed' : 'Export disabled'} · {link.allowComments ? 'Comments enabled' : 'Comments disabled'} · {link.allowDecisions ? 'Decision replies enabled' : 'Decision replies disabled'}</p>
              {link.assignments?.length ? <p className="mt-1 text-xs text-slate-500">Assigned to: {link.assignments.map(({ user }) => user.email).join(', ')}</p> : <p className="mt-1 text-xs text-slate-500">Anyone with the link can request access.</p>}
            </div>
            <div className="flex gap-2">
              <button className="rounded border px-3 py-1" onClick={() => void toggle(link)}>{link.isActive ? 'Disable' : 'Enable'}</button>
              <button className="rounded border px-3 py-1" onClick={() => void rotate(link)}>Rotate link</button>
              {link.allowComments && <button className="rounded border px-3 py-1" onClick={() => void toggleComments(link)}>{commentsOpen === link.id ? 'Hide comments' : 'Review comments'}</button>}
              {link.assignments?.length ? <button className="rounded border px-3 py-1" onClick={() => void toggleDecisionReplies(link)}>{link.allowDecisions ? 'Disable decisions' : 'Enable decisions'}</button> : null}
              <button className="rounded border border-red-300 px-3 py-1 text-red-700" onClick={() => void revoke(link)}>Revoke</button>
            </div>
            {commentsOpen === link.id && <ul className="mt-3 w-full space-y-2">{(guestComments[link.id] || []).map((comment) => <li key={comment.id} className="flex justify-between gap-3 rounded border p-3"><div><strong>{comment.displayName}</strong><p>{comment.content}</p></div><button className="text-sm text-red-700 underline" onClick={() => void deleteGuestComment(link.id, comment.id)}>Remove</button></li>)}</ul>}
          </li>
        ))}</ul>
      )}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Access requests</h2>
        {requests.length === 0 ? <p className="rounded border p-4 text-slate-600">No access requests.</p> : <ul className="space-y-2">{requests.map((request) => <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4">
          <div><p className="font-medium">{request.email}</p><p className="text-sm text-slate-600">{request.shareLink?.portal.name || 'Link no longer active'} · {request.status.toLowerCase()}</p>{request.message && <p className="mt-1 text-sm">{request.message}</p>}</div>
          {request.status === 'PENDING' && <button className="rounded border px-3 py-1" onClick={() => void reviewRequest(request)}>Mark reviewed</button>}
        </li>)}</ul>}
      </section>
    </main>
  );
}
