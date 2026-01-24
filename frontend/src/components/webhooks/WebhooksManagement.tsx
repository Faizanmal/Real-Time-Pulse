'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Webhook, Plus, Trash2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface WebhookEvent {
  id: string;
  webhookId: string;
  event: string;
  status: 'success' | 'failed' | 'pending';
  response: string;
  timestamp: string;
}

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  enabled: boolean;
  retryCount: number;
  lastTriggered: string | null;
  successCount: number;
  failureCount: number;
  createdAt: string;
}

export default function WebhooksManagement() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [_events, setEvents] = useState<WebhookEvent[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as string[],
    retryCount: 3,
    enabled: true
  });

  const fetchWebhooks = useCallback(async () => {
    try {
      const response = await fetch('/api/webhooks');
      const data = await response.json();
      setWebhooks(data);
    } catch (error) {
      console.error('Failed to fetch webhooks:', error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await fetch('/api/webhooks');
        const data = await response.json();
        if (mounted) setWebhooks(data);
      } catch (error) {
        console.error('Failed to fetch webhooks:', error);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!selectedWebhook) return;
    let mounted = true;
    (async () => {
      try {
        const response = await fetch(`/api/webhooks/${selectedWebhook}/events`);
        const data = await response.json();
        if (mounted) setEvents(data);
      } catch (error) {
        console.error('Failed to fetch webhook events:', error);
      }
    })();
    return () => { mounted = false; };
  }, [selectedWebhook, setEvents]);

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      url: '',
      events: [],
      retryCount: 3,
      enabled: true
    });
  }, []);

  const createWebhook = useCallback(async () => {
    try {
      await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      fetchWebhooks();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Failed to create webhook:', error);
    }
  }, [formData, fetchWebhooks, resetForm]);

  const toggleWebhook = useCallback(async (id: string, enabled: boolean) => {
    try {
      await fetch(`/api/webhooks/${id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      fetchWebhooks();
    } catch (error) {
      console.error('Failed to toggle webhook:', error);
    }
  }, [fetchWebhooks]);

  const testWebhook = useCallback(async (id: string) => {
    try {
      await fetch(`/api/webhooks/${id}/test`, { method: 'POST' });
      fetchWebhooks();
    } catch (error) {
      console.error('Failed to test webhook:', error);
    }
  }, [fetchWebhooks]);

  const deleteWebhook = useCallback(async (id: string) => {
    try {
      await fetch(`/api/webhooks/${id}`, { method: 'DELETE' });
      fetchWebhooks();
    } catch (error) {
      console.error('Failed to delete webhook:', error);
    }
  }, [fetchWebhooks]);


  const availableEvents = [
    'data.created',
    'data.updated',
    'data.deleted',
    'user.created',
    'user.updated',
    'alert.triggered',
    'report.generated',
    'export.completed'
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Webhook className="h-8 w-8" />
            Webhooks
          </h1>
          <p className="text-muted-foreground">Configure webhooks for event notifications</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Create Webhook
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Webhook</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Webhook Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Slack Notifications"
                />
              </div>
              <div>
                <Label>Webhook URL</Label>
                <Input
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://your-endpoint.com/webhook"
                />
              </div>
              <div>
                <Label>Events</Label>
                <div className="space-y-2 mt-2 max-h-40 overflow-y-auto">
                  {availableEvents.map((event) => (
                    <label key={event} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.events.includes(event)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, events: [...formData.events, event] });
                          } else {
                            setFormData({
                              ...formData,
                              events: formData.events.filter(ev => ev !== event)
                            });
                          }
                        }}
                      />
                      <span className="text-sm">{event}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label>Retry Count</Label>
                <Input
                  type="number"
                  value={formData.retryCount}
                  onChange={(e) => setFormData({ ...formData, retryCount: parseInt(e.target.value) })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                />
                <Label htmlFor="enabled">Webhook Enabled</Label>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={createWebhook}>Create</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Webhooks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{webhooks.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {webhooks.filter(w => w.enabled).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {webhooks.reduce((acc, w) => acc + w.successCount + w.failureCount, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {webhooks.length > 0
                ? ((webhooks.reduce((acc, w) => acc + w.successCount, 0) / 
                    webhooks.reduce((acc, w) => acc + w.successCount + w.failureCount, 0) || 0) * 100).toFixed(0)
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {webhooks.map((webhook) => (
          <Card key={webhook.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Webhook className="h-4 w-4" />
                    {webhook.name}
                  </CardTitle>
                  <CardDescription className="mt-1 font-mono text-xs">
                    {webhook.url}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={webhook.enabled ? 'default' : 'secondary'}>
                    {webhook.enabled ? 'Active' : 'Disabled'}
                  </Badge>
                  <Switch
                    checked={webhook.enabled}
                    onCheckedChange={(checked) => toggleWebhook(webhook.id, checked)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  {webhook.events.map((event) => (
                    <Badge key={event} variant="outline">{event}</Badge>
                  ))}
                </div>
                <div className="grid md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>{webhook.successCount} success</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span>{webhook.failureCount} failed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <span>{webhook.retryCount} retries</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Last: {webhook.lastTriggered ? new Date(webhook.lastTriggered).toLocaleString() : 'Never'}
                  </div>
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  <Button size="sm" variant="outline" onClick={() => testWebhook(webhook.id)}>
                    Test
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSelectedWebhook(webhook.id)}>
                    View Events
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteWebhook(webhook.id)}>
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
