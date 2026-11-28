'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { portalApi, widgetApi } from '@/lib/api-client';
import type { Portal, Widget } from '@/types';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

function reorder(items: Widget[], from: number, to: number) {
  if (to < 0 || to >= items.length || from === to) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function PortalBuilderPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);
  const canManageClientUpdate = currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN';
  const portalId = params.id;
  const [portal, setPortal] = useState<Portal | null>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [clientStatus, setClientStatus] = useState<Portal['clientStatus']>(null);
  const [clientStatusNote, setClientStatusNote] = useState('');
  const [latestDeliverable, setLatestDeliverable] = useState('');
  const [pendingDecision, setPendingDecision] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [loadedPortal, loadedWidgets] = await Promise.all([
        portalApi.getOne(portalId), widgetApi.getAllByPortal(portalId),
      ]);
      const layout = loadedPortal.layout as { widgetOrder?: string[] } | null;
      const order = layout?.widgetOrder;
      const originalIndex = new Map(loadedWidgets.map((widget, index) => [widget.id, index]));
      const orderedWidgets = [...loadedWidgets].sort((a, b) => {
        const ai = order?.indexOf(a.id) ?? -1;
        const bi = order?.indexOf(b.id) ?? -1;
        return (ai < 0 ? (order ? Number.MAX_SAFE_INTEGER : originalIndex.get(a.id) ?? 0) : ai)
          - (bi < 0 ? (order ? Number.MAX_SAFE_INTEGER : originalIndex.get(b.id) ?? 0) : bi);
      });
      setPortal(loadedPortal);
      setName(loadedPortal.name);
      setDescription(loadedPortal.description ?? '');
      setClientStatus(loadedPortal.clientStatus ?? null);
      setClientStatusNote(loadedPortal.clientStatusNote ?? '');
      setLatestDeliverable(loadedPortal.latestDeliverable ?? '');
      setPendingDecision(loadedPortal.pendingDecision ?? '');
      setWidgets(orderedWidgets);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Portal could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [portalId]);

  useEffect(() => { void load(); }, [load]);

  const saveDraft = async () => {
    if (!portal) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const currentLayout = portal.layout && typeof portal.layout === 'object' && !Array.isArray(portal.layout)
        ? (portal.layout as Record<string, unknown>)
        : {};
      const saved = await portalApi.update(portal.id, {
        name: name.trim(), description: description.trim(),
        layout: { ...currentLayout, widgetOrder: widgets.map((w) => w.id) },
        ...(canManageClientUpdate ? {
          clientStatus, clientStatusNote: clientStatusNote.trim() || null,
          latestDeliverable: latestDeliverable.trim() || null, pendingDecision: pendingDecision.trim() || null,
        } : {}),
      });
      setPortal(saved);
      setNotice('Draft saved. Reload to verify the layout persisted.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Draft could not be saved.');
    } finally { setSaving(false); }
  };

  const publish = async () => {
    if (!portal) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const currentLayout = portal.layout && typeof portal.layout === 'object' && !Array.isArray(portal.layout)
        ? (portal.layout as Record<string, unknown>)
        : {};
      const saved = await portalApi.update(portal.id, {
        name: name.trim(), description: description.trim(),
        layout: { ...currentLayout, widgetOrder: widgets.map((w) => w.id) },
        ...(canManageClientUpdate ? {
          clientStatus, clientStatusNote: clientStatusNote.trim() || null,
          latestDeliverable: latestDeliverable.trim() || null, pendingDecision: pendingDecision.trim() || null,
        } : {}),
      });
      await portalApi.publishDraft(portal.id, saved.updatedAt);
      setNotice('Published snapshot created. Public visibility remains controlled separately.');
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Portal could not be published.';
      setError(message.includes('changed') ? `${message} Your saved changes are still in the draft.` : message);
    } finally { setSaving(false); }
  };

  const togglePublic = async () => {
    if (!portal) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const updated = await portalApi.update(portal.id, { isPublic: !portal.isPublic });
      setPortal(updated);
      setNotice(updated.isPublic ? 'Public link enabled.' : 'Public link disabled.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Visibility could not be changed.'); }
    finally { setSaving(false); }
  };

  if (loading) return <main aria-busy="true" className="mx-auto max-w-4xl p-6">Loading portal builder…</main>;
  if (error && !portal) return <main className="mx-auto max-w-4xl space-y-4 p-6"><h1 className="text-2xl font-bold">Portal unavailable</h1><p role="alert">{error}</p><Button onClick={() => void load()}>Retry</Button></main>;
  if (!portal) return <main className="p-6">Portal not found.</main>;

  const move = (index: number, delta: number) => setWidgets((current) => reorder(current, index, index + delta));
  return <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Portal builder</h1><p className="text-sm text-muted-foreground">Draft changes stay private until you publish.</p></div>
      <span aria-label="Portal status" className="rounded border px-3 py-1 text-sm">{portal.publishedAt ? `Published · revision ${portal.publishRevision}` : 'Draft'}{portal.isPublic && portal.publishedAt ? ' · Public link on' : portal.isPublic ? ' · Will publish publicly' : ' · Private'}</span>
    </header>
    {error && <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-900">{error}</p>}
    {notice && <p role="status" className="rounded border border-green-300 bg-green-50 p-3 text-green-900">{notice}</p>}
    <section aria-label="Portal settings" className="space-y-3 rounded-lg border p-4">
      <label className="block text-sm font-medium" htmlFor="portal-name">Portal name</label><Input id="portal-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      <label className="block text-sm font-medium" htmlFor="portal-description">Client description</label><Textarea id="portal-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
    </section>
    {canManageClientUpdate && <section aria-label="Client update" className="space-y-3 rounded-lg border p-4">
      <div><h2 className="text-lg font-semibold">Client update</h2><p className="text-sm text-muted-foreground">These notes appear in the client view after publication. Leave a field blank when there is no update.</p></div>
      <label className="block text-sm font-medium" htmlFor="client-status">Status</label>
      <select id="client-status" className="w-full rounded-md border bg-background p-2" value={clientStatus ?? ''} onChange={(event) => setClientStatus((event.target.value || null) as Portal['clientStatus'])}>
        <option value="">Not reported</option><option value="ON_TRACK">On track</option><option value="NEEDS_ATTENTION">Needs attention</option><option value="BLOCKED">Blocked</option><option value="COMPLETED">Completed</option>
      </select>
      <label className="block text-sm font-medium" htmlFor="client-status-note">Client-visible status note</label><Textarea id="client-status-note" maxLength={500} value={clientStatusNote} onChange={(event) => setClientStatusNote(event.target.value)} />
      <label className="block text-sm font-medium" htmlFor="latest-deliverable">Latest deliverable (client visible)</label><Input id="latest-deliverable" maxLength={240} value={latestDeliverable} onChange={(event) => setLatestDeliverable(event.target.value)} placeholder="e.g. November campaign review" />
      <label className="block text-sm font-medium" htmlFor="pending-decision">Pending decision (client visible)</label><Input id="pending-decision" maxLength={240} value={pendingDecision} onChange={(event) => setPendingDecision(event.target.value)} placeholder="Leave blank when no decision is pending" />
    </section>}
    <section aria-label="Portal widgets" className="space-y-3">
      <div><h2 className="text-lg font-semibold">Client widgets</h2><p className="text-sm text-muted-foreground">Drag to reorder, or use the move buttons. Private connector settings are never included in client preview.</p></div>
      {widgets.length === 0 ? <p className="rounded border border-dashed p-6 text-sm">No widgets yet. Add a connector and widget from the dashboard to include client data.</p> : <ol className="space-y-2">{widgets.map((widget, index) => <li key={widget.id} draggable onDragStart={() => setDragIndex(index)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragIndex !== null) setWidgets((current) => reorder(current, dragIndex, index)); setDragIndex(null); }} onDragEnd={() => setDragIndex(null)} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
        <span aria-hidden="true" className="cursor-grab select-none px-2">⠿</span><div className="min-w-0 flex-1"><p className="font-medium">{widget.name}</p><p className="text-xs text-muted-foreground">{widget.type} · {widget.integration?.provider ?? 'No connector attached'}</p></div>
        <Button type="button" size="sm" variant="outline" aria-label={`Move ${widget.name} up`} disabled={index === 0} onClick={() => move(index, -1)}>Move up</Button>
        <Button type="button" size="sm" variant="outline" aria-label={`Move ${widget.name} down`} disabled={index === widgets.length - 1} onClick={() => move(index, 1)}>Move down</Button>
      </li>)}</ol>}
    </section>
    <section className="flex flex-wrap gap-2 border-t pt-4">
      <Button disabled={saving} onClick={() => void saveDraft()}>{saving ? 'Saving…' : 'Save draft'}</Button>
      <Button disabled={saving} variant="default" onClick={() => void publish()}>{saving ? 'Working…' : 'Publish snapshot'}</Button>
      <Button disabled={saving} variant="outline" onClick={() => router.push(`/v/preview?previewPortalId=${encodeURIComponent(portal.id)}`)}>Preview as client</Button>
      <Button disabled={saving || !portal.publishedAt} variant="outline" onClick={() => void togglePublic()}>{portal.isPublic ? 'Disable public link' : 'Enable public link'}</Button>
      {portal.isPublic && portal.publishedAt && <Button asChild variant="outline"><a href={`/v/${encodeURIComponent(portal.shareToken)}`} target="_blank" rel="noreferrer">Open client link</a></Button>}
    </section>
    {portal.publishedAt && <p className="text-xs text-muted-foreground">Last published {new Date(portal.publishedAt).toLocaleString()} · revision {portal.publishRevision}</p>}
  </main>;
}
