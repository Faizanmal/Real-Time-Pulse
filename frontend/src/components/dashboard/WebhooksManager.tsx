'use client';

import { useState, useEffect, useCallback } from 'react';
import { Webhook, Plus, Trash2, Eye, EyeOff, TestTube, RefreshCw, ExternalLink } from 'lucide-react';
import { webhooksApi, Webhook as WebhookType, CreateWebhookDto, WEBHOOK_EVENTS, WebhookDelivery } from '../../lib/enterprise-api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function WebhooksManager({ className }: { className?: string }) {
  const [webhooks, setWebhooks] = useState<WebhookType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    loadWebhooks();
  }, []);

  const loadWebhooks = async () => {
    try {
      const data = await webhooksApi.getAllWebhooks();
      setWebhooks(data);
    } catch (error) {
      console.error('Failed to load webhooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteWebhook = async (webhookId: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;

    try {
      await webhooksApi.deleteWebhook(webhookId);
      setWebhooks(webhooks.filter(w => w.id !== webhookId));
      toast.success('Webhook deleted');
    } catch {
      toast.error('Failed to delete webhook');
    }
  };

  const testWebhook = async (webhookId: string) => {
    try {
      const result = await webhooksApi.testWebhook(webhookId);
      toast.success(`Test webhook sent! Message: ${result.message}`);
    } catch {
      toast.error('Failed to test webhook');
    }
  };

  const toggleWebhook = async (webhookId: string, isActive: boolean) => {
    try {
      await webhooksApi.updateWebhook(webhookId, { isActive });
      setWebhooks(webhooks.map(w => w.id === webhookId ? { ...w, isActive } : w));
      toast.success(`Webhook ${isActive ? 'enabled' : 'disabled'}`);
    } catch {
      toast.error('Failed to update webhook');
    }
  };

  const regenerateSecret = async (webhookId: string) => {
    if (!confirm('Are you sure? This will invalidate the old secret.')) return;

    try {
      const result = await webhooksApi.regenerateSecret(webhookId);
      toast.success('Secret regenerated. Copy the new secret now!');
      // Update webhook in list
      setWebhooks(webhooks.map(w => w.id === webhookId ? { ...w, secret: result.secret } : w));
    } catch {
      toast.error('Failed to regenerate secret');
    }
  };

  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5 text-purple-500" />
          <h3 className="text-lg font-semibold">Webhooks</h3>
          {webhooks.length > 0 && (
            <Badge variant="secondary">{webhooks.length}</Badge>
          )}
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Create Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <WebhookForm
              onSuccess={() => {
                setIsDialogOpen(false);
                loadWebhooks();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-gray-200 rounded"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Webhook className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No webhooks configured. Create your first webhook to receive events.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <WebhookCard
              key={webhook.id}
              webhook={webhook}
              onDelete={deleteWebhook}
              onTest={testWebhook}
              onToggle={toggleWebhook}
              onRegenerateSecret={regenerateSecret}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

interface WebhookCardProps {
  webhook: WebhookType;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
  onToggle: (id: string, isActive: boolean) => void;
  onRegenerateSecret: (id: string) => void;
}

function WebhookCard({ webhook, onDelete, onTest, onToggle, onRegenerateSecret }: WebhookCardProps) {
  const [showSecret, setShowSecret] = useState(false);
  const [showDeliveries, setShowDeliveries] = useState(false);

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-semibold">{webhook.name}</h4>
            {webhook.isActive ? (
              <Badge variant="default" className="bg-green-500">Active</Badge>
            ) : (
              <Badge variant="secondary">Inactive</Badge>
            )}
          </div>

          

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">URL:</span>
              <code className="bg-gray-100 px-2 py-1 rounded text-xs flex-1 truncate">
                {webhook.url}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(webhook.url, '_blank')}
                className="h-6 w-6 p-0"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-gray-500">Events:</span>
              <div className="flex flex-wrap gap-1">
                {webhook.events.map((event: string) => (
                  <Badge key={event} variant="outline" className="text-xs">
                    {event}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-gray-500">Secret:</span>
              <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                {showSecret ? webhook.secret : '••••••••••••••••'}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSecret(!showSecret)}
                className="h-6 w-6 p-0"
              >
                {showSecret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRegenerateSecret(webhook.id)}
                className="h-6 w-6 p-0"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>

            

            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">Deliveries:</span>
              <span className="text-green-600">{webhook.successCount} successful</span>
              <span className="text-red-600">{webhook.failureCount} failed</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeliveries(!showDeliveries)}
                className="h-6 text-xs px-2"
              >
                {showDeliveries ? 'Hide' : 'Show'} History
              </Button>
            </div>
          </div>

          {showDeliveries && (
            <WebhookDeliveries webhookId={webhook.id} />
          )}
        </div>

        <div className="flex items-center gap-2 ml-4">
          <Switch
            checked={webhook.isActive}
            onCheckedChange={(checked) => onToggle(webhook.id, checked)}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onTest(webhook.id)}
            className="h-8 w-8 p-0"
          >
            <TestTube className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(webhook.id)}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function WebhookDeliveries({ webhookId }: { webhookId: string }) {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDeliveries = useCallback(async () => {
    try {
      const data = await webhooksApi.getWebhookDeliveries(webhookId);
      setDeliveries(data);
    } catch {
      console.error('Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  }, [webhookId]);
  useEffect(() => {
    loadDeliveries();
  }, [loadDeliveries]);

  if (loading) {
    return <div className="mt-4 text-sm text-gray-500">Loading deliveries...</div>;
  }

  if (deliveries.length === 0) {
    return <div className="mt-4 text-sm text-gray-500">No deliveries yet</div>;
  }

  return (
    <div className="mt-4 border-t pt-4">
      <h5 className="text-sm font-semibold mb-2">Recent Deliveries</h5>
      <div className="space-y-2">
        {deliveries.slice(0, 5).map((delivery) => (
          <div key={delivery.id} className="text-xs bg-gray-50 p-2 rounded">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium">{delivery.event}</span>
              <Badge 
                variant={delivery.status === 'SUCCESS' ? 'default' : 'destructive'}
                className="text-xs"
              >
                {delivery.status}
              </Badge>
            </div>
            <div className="text-gray-600">
              {new Date(delivery.createdAt).toLocaleString()}
            </div>
            {delivery.responseCode && (
              <div className="text-gray-600">
                Response: {delivery.responseCode}
              </div>
            )}
            {delivery.error && (
              <div className="text-red-600 mt-1">
                Error: {delivery.error}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface WebhookFormProps {
  onSuccess: () => void;
}

function WebhookForm({ onSuccess }: WebhookFormProps) {
  const [formData, setFormData] = useState<CreateWebhookDto>({
    name: '',
    url: '',
    events: [],
  });
  const [submitting, setSubmitting] = useState(false);

  const toggleEvent = (event: string) => {
    const events = formData.events.includes(event)
      ? formData.events.filter((e: string) => e !== event)
      : [...formData.events, event];
    setFormData({ ...formData, events });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.events.length === 0) {
      toast.error('Please select at least one event');
      return;
    }

    setSubmitting(true);

    try {
      await webhooksApi.createWebhook(formData);
      toast.success('Webhook created successfully');
      onSuccess();
    } catch {
      toast.error('Failed to create webhook');
    } finally {
      // Removed: lastDeliveryAt property does not exist on Webhook
    }
  };

  const eventGroups = {
    'Portal Events': WEBHOOK_EVENTS.PORTAL.map(e => e.value),
    'Widget Events': WEBHOOK_EVENTS.WIDGET.map(e => e.value),
    'Data Events': WEBHOOK_EVENTS.REPORT.map(e => e.value),
    'User Events': WEBHOOK_EVENTS.INTEGRATION.map(e => e.value),
    'Alert Events': WEBHOOK_EVENTS.ALERT.map(e => e.value),
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Create Webhook</DialogTitle>
        <DialogDescription>
          Set up a webhook to receive real-time event notifications
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Webhook Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="My Integration Webhook"
            required
          />
        </div>

        <div>
          <Label htmlFor="url">Webhook URL *</Label>
          <Input
            id="url"
            type="url"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            placeholder="https://your-api.com/webhook"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            We&apos;ll send POST requests to this URL
          </p>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
            {/* Removed: description property does not exist on CreateWebhookDto */}
        </div>

        <div>
          <Label>Events to Subscribe *</Label>
          <p className="text-xs text-gray-500 mb-2">
            Select which events should trigger this webhook
          </p>
          <div className="border rounded-lg p-4 max-h-80 overflow-y-auto">
            {Object.entries(eventGroups).map(([group, events]) => (
              <div key={group} className="mb-4 last:mb-0">
                <h4 className="text-sm font-semibold mb-2">{group}</h4>
                <div className="space-y-1">
                  {events.map((event: string) => (
                    <label key={event} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.events.includes(event)}
                        onChange={() => toggleEvent(event)}
                        className="rounded"
                      />
                      <span className="text-sm">{event}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {formData.events.length} event{formData.events.length !== 1 ? 's' : ''} selected
          </p>
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
          <div>
            <Label htmlFor="isActive">Active</Label>
            <p className="text-xs text-gray-500">Start receiving events immediately</p>
          </div>
          <Switch
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create Webhook'}
        </Button>
      </div>
    </form>
  );
}

