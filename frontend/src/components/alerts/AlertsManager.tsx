'use client';

import { AlertTriangle, Bell, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { alertsApi, type Alert, type AlertChannel, type AlertSeverity, type CreateAlertDto } from '@/lib/api/alerts';

const CHANNEL_OPTIONS: AlertChannel[] = ['email', 'slack', 'webhook'];
const EMPTY_FORM: CreateAlertDto = {
  name: '',
  description: '',
  condition: { metric: 'provider.sync_failures', operator: '>=', threshold: 1 },
  severity: 'HIGH',
  channels: ['email'],
  emailRecipients: [],
  isActive: true,
  suppressionWindowSeconds: 900,
};

const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleString() : 'Not available';

export default function AlertsManager() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CreateAlertDto>(EMPTY_FORM);
  const [recipientText, setRecipientText] = useState('');
  const [slackWebhook, setSlackWebhook] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    setError(null);
    try {
      setAlerts(await alertsApi.getAll());
    } catch {
      setError('Alerts could not be loaded. Retry to check workspace status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAlerts(); }, [loadAlerts]);

  const metrics = useMemo(() => ({
    active: alerts.filter((alert) => alert.isActive).length,
    firing: alerts.filter((alert) => alert.isFiring).length,
    failed: alerts.reduce((count, alert) => count + (alert.history ?? []).flatMap((event) => event.deliveries).filter((delivery) => delivery.status === 'FAILED').length, 0),
  }), [alerts]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setRecipientText('');
    setSlackWebhook('');
    setWebhookUrl('');
    setEditingId(null);
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    const payload: CreateAlertDto = {
      ...form,
      emailRecipients: recipientText.split(',').map((entry) => entry.trim()).filter(Boolean),
      ...(slackWebhook.trim() ? { slackWebhook: slackWebhook.trim() } : {}),
      ...(webhookUrl.trim() ? { webhookUrl: webhookUrl.trim() } : {}),
    };
    try {
      if (editingId) await alertsApi.update(editingId, payload);
      else await alertsApi.create(payload);
      resetForm();
      await loadAlerts();
    } catch {
      setError('Alert could not be saved. Check the rule and channel settings, then retry.');
    } finally {
      setSaving(false);
    }
  };

  const edit = (alert: Alert) => {
    setEditingId(alert.id);
    setForm({
      name: alert.name,
      description: alert.description ?? '',
      condition: alert.condition,
      severity: alert.severity,
      channels: alert.channels,
      emailRecipients: alert.emailRecipients,
      isActive: alert.isActive,
      suppressionWindowSeconds: alert.suppressionWindowSeconds,
    });
    setRecipientText(alert.emailRecipients.join(', '));
    setSlackWebhook('');
    setWebhookUrl('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this alert and its history?')) return;
    setError(null);
    try {
      await alertsApi.delete(id);
      await loadAlerts();
    } catch {
      setError('Alert could not be deleted. Refresh and retry.');
    }
  };

  const toggle = async (alert: Alert) => {
    setError(null);
    try {
      await alertsApi.update(alert.id, { isActive: !alert.isActive });
      await loadAlerts();
    } catch {
      setError('Alert status could not be changed. Refresh and retry.');
    }
  };

  const retry = async (alertId: string, deliveryId: string) => {
    setError(null);
    try {
      await alertsApi.retryDelivery(alertId, deliveryId);
      await loadAlerts();
    } catch {
      setError('Delivery retry failed or is already in progress. Check its latest status.');
    }
  };

  const updateCondition = (field: keyof CreateAlertDto['condition'], value: string) => {
    setForm((current) => ({
      ...current,
      condition: {
        ...current.condition,
        [field]: field === 'threshold' ? Number(value) : value,
      },
    }));
  };

  const toggleChannel = (channel: AlertChannel) => {
    setForm((current) => ({
      ...current,
      channels: current.channels?.includes(channel)
        ? current.channels.filter((entry) => entry !== channel)
        : [...(current.channels ?? []), channel],
    }));
  };

  if (loading) return <div role="status" className="p-8">Loading alert rules and recent activity…</div>;

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="flex items-center gap-2 text-3xl font-bold"><Bell aria-hidden="true" /> Alerting and escalation</h1>
        <p className="mt-1 text-muted-foreground">Provider sync alerts include their source, freshness, reason and next action.</p>
      </header>

      {error && <div role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-900">{error} <Button variant="outline" size="sm" onClick={() => void loadAlerts()}>Retry</Button></div>}

      <section aria-label="Alert health metrics" className="grid gap-3 sm:grid-cols-3">
        <Card><CardHeader><CardTitle>Active rules</CardTitle></CardHeader><CardContent>{metrics.active}</CardContent></Card>
        <Card><CardHeader><CardTitle>Currently firing</CardTitle></CardHeader><CardContent>{metrics.firing}</CardContent></Card>
        <Card><CardHeader><CardTitle>Failed deliveries</CardTitle></CardHeader><CardContent>{metrics.failed}</CardContent></Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? 'Edit alert rule' : 'Create alert rule'}</CardTitle>
          <CardDescription>For sync health, use metric <code>provider.sync_failures</code>. Critical severity bypasses suppression.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm">Name<Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={120} /></label>
          <label className="grid gap-1 text-sm">Description<Input value={form.description ?? ''} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={500} /></label>
          <label className="grid gap-1 text-sm">Metric<Input value={form.condition.metric} onChange={(event) => updateCondition('metric', event.target.value)} maxLength={120} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-sm">Operator<select aria-label="Alert operator" className="h-10 rounded-md border bg-background px-3" value={form.condition.operator} onChange={(event) => updateCondition('operator', event.target.value)}>{['>', '>=', '<', '<=', '==', '!='].map((operator) => <option key={operator} value={operator}>{operator}</option>)}</select></label>
            <label className="grid gap-1 text-sm">Threshold<Input type="number" value={form.condition.threshold} onChange={(event) => updateCondition('threshold', event.target.value)} /></label>
          </div>
          <label className="grid gap-1 text-sm">Severity<select aria-label="Alert severity" className="h-10 rounded-md border bg-background px-3" value={form.severity ?? 'MEDIUM'} onChange={(event) => setForm({ ...form, severity: event.target.value as AlertSeverity })}>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((severity) => <option key={severity}>{severity}</option>)}</select></label>
          <label className="grid gap-1 text-sm">Suppression window (seconds)<Input type="number" min={0} max={86400} value={form.suppressionWindowSeconds ?? 900} onChange={(event) => setForm({ ...form, suppressionWindowSeconds: Number(event.target.value) })} /></label>
          <fieldset className="grid gap-2 md:col-span-2">
            <legend className="text-sm font-medium">Notification channels</legend>
            <div className="flex flex-wrap gap-4">{CHANNEL_OPTIONS.map((channel) => <label key={channel} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.channels?.includes(channel) ?? false} onChange={() => toggleChannel(channel)} />{channel}</label>)}</div>
          </fieldset>
          {form.channels?.includes('email') && <label className="grid gap-1 text-sm md:col-span-2">Email recipients (comma separated)<Input value={recipientText} onChange={(event) => setRecipientText(event.target.value)} placeholder="ops@example.test" /></label>}
          {form.channels?.includes('slack') && <label className="grid gap-1 text-sm md:col-span-2">Slack webhook URL<Input type="password" autoComplete="new-password" value={slackWebhook} onChange={(event) => setSlackWebhook(event.target.value)} placeholder={editingId ? 'Leave blank to keep the configured secret' : 'https://hooks.slack.com/services/…'} /></label>}
          {form.channels?.includes('webhook') && <label className="grid gap-1 text-sm md:col-span-2">Webhook URL<Input type="password" autoComplete="new-password" value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} placeholder={editingId ? 'Leave blank to keep the configured secret' : 'https://example.test/alerts'} /></label>}
          <div className="flex gap-2 md:col-span-2">
            <Button disabled={saving || !form.name.trim() || !form.condition.metric.trim() || !form.channels?.length || !Number.isFinite(form.condition.threshold)} onClick={() => void submit()}>{saving ? 'Saving…' : editingId ? 'Save alert' : <><Plus className="mr-2 h-4 w-4" />Create alert</>}</Button>
            {editingId && <Button variant="outline" onClick={resetForm}>Cancel</Button>}
          </div>
        </CardContent>
      </Card>

      <section aria-labelledby="alerts-list-heading" className="space-y-3">
        <h2 id="alerts-list-heading" className="text-xl font-semibold">Rules and recent events</h2>
        {!alerts.length && <Card><CardContent className="py-8 text-center text-muted-foreground">No alert rules yet. Create one to monitor provider health.</CardContent></Card>}
        {alerts.map((alert) => (
          <Card key={alert.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><CardTitle>{alert.name}</CardTitle><CardDescription>{alert.description || alert.condition.metric}</CardDescription></div>
                <div className="flex items-center gap-2"><Badge variant={alert.severity === 'CRITICAL' ? 'destructive' : 'outline'}>{alert.severity}</Badge><Badge variant="outline">{alert.isFiring ? 'FIRING' : alert.isActive ? 'ARMED' : 'PAUSED'}</Badge></div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">Source: <strong>{alert.condition.metric}</strong> · Rule: value {alert.condition.operator} {alert.condition.threshold} · Suppression: {alert.suppressionWindowSeconds}s</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void toggle(alert)}>{alert.isActive ? 'Pause' : 'Enable'}</Button>
                <Button size="sm" variant="outline" onClick={() => edit(alert)}>Edit</Button>
                <Button size="sm" variant="destructive" onClick={() => void remove(alert.id)}><Trash2 className="mr-1 h-3 w-3" />Delete</Button>
                <span className="self-center text-xs text-muted-foreground">Last evaluated: {dateLabel(alert.lastEvaluatedAt)} · Triggered {alert.triggerCount} times</span>
              </div>
              {!alert.history?.length && <p className="rounded bg-muted/40 p-3 text-sm text-muted-foreground">No matching provider signal has been evaluated yet. Freshness is not available until the first signal.</p>}
              {alert.history?.map((event) => (
                <article key={event.id} className="space-y-2 rounded border p-3" aria-label={`${event.severity} alert event ${event.status.toLowerCase()}`}>
                  <div className="flex flex-wrap items-center gap-2"><Badge variant={event.severity === 'CRITICAL' ? 'destructive' : 'outline'}>{event.severity}</Badge><Badge variant="outline">{event.status}</Badge><time className="text-xs text-muted-foreground" dateTime={event.triggeredAt}>Observed {dateLabel(event.triggeredAt)}</time></div>
                  <p className="text-sm"><strong>Source:</strong> {event.source} · <strong>Freshness:</strong> {dateLabel(event.freshnessAt)} · <strong>Value:</strong> {event.triggeredValue?.value ?? 'Not available'}</p>
                  <p className="text-sm"><strong>Why:</strong> {event.reason || 'Condition matched'}{event.suppressedCount > 0 ? ` · Suppressed repeats: ${event.suppressedCount}` : ''}</p>
                  <p className="text-sm"><strong>Next action:</strong> {event.nextAction || 'Review the source and alert condition.'}</p>
                  {event.deliveries.map((delivery) => <div key={delivery.id} className="flex flex-wrap items-center gap-2 text-sm"><span>{delivery.channel}: {delivery.status.toLowerCase()} · attempts {delivery.attemptCount}{delivery.lastErrorCode ? ` · ${delivery.lastErrorCode}` : ''}{delivery.sentAt ? ` · sent ${dateLabel(delivery.sentAt)}` : ''}</span>{delivery.status === 'FAILED' && <Button size="sm" variant="outline" onClick={() => void retry(alert.id, delivery.id)}><RefreshCw className="mr-1 h-3 w-3" />Retry</Button>}</div>)}
                </article>
              ))}
            </CardContent>
          </Card>
        ))}
      </section>
      <p className="flex gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-4 w-4 shrink-0" />Repeated events with the same ID are ignored. Non-critical events within the suppression window are recorded without another notification; CRITICAL alerts bypass suppression.</p>
    </div>
  );
}
