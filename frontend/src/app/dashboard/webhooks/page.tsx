'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { webhooksApi, WEBHOOK_EVENTS, type Webhook, type WebhookDelivery } from '@/lib/api/index';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Webhook as WebhookIcon, Plus, RefreshCw, Edit, Trash2, Play,
  CheckCircle2, XCircle, Clock, Globe, Key, Shield, History
} from 'lucide-react';
import { toast } from 'sonner';

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [deliveriesDialogOpen, setDeliveriesDialogOpen] = useState(false);
  const [selectedWebhookDeliveries, setSelectedWebhookDeliveries] = useState<WebhookDelivery[]>([]);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formSecret, setFormSecret] = useState('');
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadWebhooks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await webhooksApi.getAll();
      setWebhooks(data);
    } catch (error) {
      console.error('Failed to load webhooks:', error);
      toast.error('Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWebhooks();
  }, [loadWebhooks]);

  const resetForm = () => {
    setFormName('');
    setFormUrl('');
    setFormSecret('');
    setFormEvents([]);
    setFormActive(true);
    setEditingWebhook(null);
  };

  const openEditDialog = (webhook: Webhook) => {
    setEditingWebhook(webhook);
    setFormName(webhook.name);
    setFormUrl(webhook.url);
    setFormSecret(webhook.secret || '');
    setFormEvents(webhook.events);
    setFormActive(webhook.active);
    setCreateDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formUrl.trim()) {
      toast.error('Please enter a webhook URL');
      return;
    }
    if (formEvents.length === 0) {
      toast.error('Please select at least one event');
      return;
    }

    setSaving(true);
    try {
      if (editingWebhook) {
        await webhooksApi.update(editingWebhook.id, {
          name: formName,
          url: formUrl,
          secret: formSecret || undefined,
          events: formEvents,
          active: formActive,
        });
        toast.success('Webhook updated');
      } else {
        await webhooksApi.create({
          name: formName,
          url: formUrl,
          secret: formSecret || undefined,
          events: formEvents,
          active: formActive,
        });
        toast.success('Webhook created');
      }
      setCreateDialogOpen(false);
      resetForm();
      loadWebhooks();
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('Failed to save webhook');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;

    try {
      await webhooksApi.delete(id);
      toast.success('Webhook deleted');
      loadWebhooks();
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Failed to delete webhook');
    }
  };

  const handleTest = async (id: string) => {
    try {
      await webhooksApi.test(id);
      toast.success('Test webhook sent');
    } catch (error) {
      console.error('Test failed:', error);
      toast.error('Failed to send test webhook');
    }
  };

  const handleToggle = async (webhook: Webhook) => {
    try {
      await webhooksApi.update(webhook.id, { active: !webhook.active });
      loadWebhooks();
    } catch (error) {
      console.error('Toggle failed:', error);
      toast.error('Failed to update webhook');
    }
  };

  const viewDeliveries = async (webhookId: string) => {
    try {
      const deliveries = await webhooksApi.getDeliveries(webhookId);
      setSelectedWebhookDeliveries(deliveries);
      setDeliveriesDialogOpen(true);
    } catch (error) {
      console.error('Failed to load deliveries:', error);
      toast.error('Failed to load delivery history');
    }
  };

  const toggleEvent = (event: string) => {
    setFormEvents(prev => 
      prev.includes(event) 
        ? prev.filter(e => e !== event)
        : [...prev, event]
    );
  };

  const stats = {
    total: webhooks.length,
    active: webhooks.filter(w => w.active).length,
    successful: webhooks.filter(w => w.lastDeliveryStatus === 'success').length,
    failed: webhooks.filter(w => w.lastDeliveryStatus === 'failed').length,
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <WebhookIcon className="h-8 w-8 text-purple-500" />
            Webhooks
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure HTTP callbacks for real-time event notifications
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadWebhooks} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={(open) => { setCreateDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Webhook
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingWebhook ? 'Edit Webhook' : 'Create Webhook'}</DialogTitle>
                <DialogDescription>
                  Configure a webhook endpoint to receive event notifications
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="Webhook name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="url" className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Payload URL
                  </Label>
                  <Input
                    id="url"
                    placeholder="https://your-server.com/webhooks"
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secret" className="flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Secret (optional)
                  </Label>
                  <Input
                    id="secret"
                    type="password"
                    placeholder="Used to sign payloads"
                    value={formSecret}
                    onChange={(e) => setFormSecret(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    If provided, payloads will be signed using HMAC-SHA256
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Events
                  </Label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded-lg">
                    {WEBHOOK_EVENTS.map((event) => (
                      <div key={event} className="flex items-center space-x-2">
                        <Checkbox
                          id={event}
                          checked={formEvents.includes(event)}
                          onCheckedChange={() => toggleEvent(event)}
                        />
                        <label htmlFor={event} className="text-sm cursor-pointer">
                          {event}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="active">Active</Label>
                  <Switch
                    id="active"
                    checked={formActive}
                    onCheckedChange={setFormActive}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setCreateDialogOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingWebhook ? 'Update' : 'Create'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Webhooks</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <WebhookIcon className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">{stats.active}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Last Success</p>
                <p className="text-2xl font-bold">{stats.successful}</p>
              </div>
              <Globe className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold">{stats.failed}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Webhook List */}
      <Card>
        <CardHeader>
          <CardTitle>Configured Webhooks</CardTitle>
          <CardDescription>Manage your webhook endpoints</CardDescription>
        </CardHeader>
        <CardContent>
          {webhooks.length === 0 ? (
            <div className="text-center py-12">
              <WebhookIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No webhooks configured</h3>
              <p className="text-muted-foreground mb-4">Add a webhook to receive real-time event notifications</p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Webhook
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {webhooks.map((webhook, index) => (
                  <motion.div
                    key={webhook.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${webhook.active ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
                        <WebhookIcon className={`h-5 w-5 ${webhook.active ? 'text-green-600' : 'text-gray-500'}`} />
                      </div>
                      <div>
                        <p className="font-medium font-mono text-sm">{webhook.url}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {webhook.events.length} events
                          </Badge>
                          {webhook.lastDeliveryAt && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Last: {new Date(webhook.lastDeliveryAt).toLocaleString()}
                            </span>
                          )}
                          {webhook.lastDeliveryStatus && (
                            <Badge variant={webhook.lastDeliveryStatus === 'success' ? 'default' : 'destructive'}>
                              {webhook.lastDeliveryStatus}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={webhook.active}
                        onCheckedChange={() => handleToggle(webhook)}
                      />
                      <Button variant="ghost" size="icon" onClick={() => viewDeliveries(webhook.id)} title="Delivery History">
                        <History className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleTest(webhook.id)} title="Test">
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(webhook)} title="Edit">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(webhook.id)} className="text-red-500 hover:text-red-600" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deliveries Dialog */}
      <Dialog open={deliveriesDialogOpen} onOpenChange={setDeliveriesDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Delivery History</DialogTitle>
            <DialogDescription>
              Recent webhook deliveries and their status
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto max-h-96">
            {selectedWebhookDeliveries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No deliveries yet</p>
            ) : (
              <div className="space-y-2">
                {selectedWebhookDeliveries.map((delivery) => (
                  <div key={delivery.id} className="p-3 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={delivery.status === 'success' ? 'default' : 'destructive'}>
                        {delivery.status} - {delivery.statusCode}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(delivery.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm font-medium mb-1">Event: {delivery.event}</p>
                    <p className="text-xs text-muted-foreground">
                      Response time: {delivery.responseTime}ms
                      {delivery.attempt > 1 && ` (Attempt ${delivery.attempt})`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
