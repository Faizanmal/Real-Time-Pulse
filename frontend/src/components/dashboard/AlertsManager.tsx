'use client';

import { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, TestTube } from 'lucide-react';
import { alertsApi, Alert, CreateAlertDto } from '@/src/lib/enterprise-api';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Textarea } from '@/src/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { Switch } from '@/src/components/ui/switch';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';

export function AlertsManager({ className }: { className?: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const data = await alertsApi.getAllAlerts();
      setAlerts(data);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteAlert = async (alertId: string) => {
    if (!confirm('Are you sure you want to delete this alert?')) return;

    try {
      await alertsApi.deleteAlert(alertId);
      setAlerts(alerts.filter(a => a.id !== alertId));
      toast.success('Alert deleted');
    } catch (error: unknown) {
      console.error('Failed to delete alert:', error);
      toast.error('Failed to delete alert');
    }
  };

  const testAlert = async (alertId: string) => {
    try {
      await alertsApi.testAlert(alertId);
      toast.success('Test alert sent');
    } catch (error: unknown) {
      console.error('Failed to test alert:', error);
      toast.error('Failed to test alert');
    }
  };

  const toggleAlert = async (alertId: string, isActive: boolean) => {
    try {
      await alertsApi.updateAlert(alertId, { isActive });
      setAlerts(alerts.map(a => a.id === alertId ? { ...a, isActive } : a));
      toast.success(`Alert ${isActive ? 'enabled' : 'disabled'}`);
    } catch (error: unknown) {
      console.error('Failed to update alert:', error);
      toast.error('Failed to update alert');
    }
  };

  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">Smart Alerts</h3>
          {alerts.length > 0 && (
            <Badge variant="secondary">{alerts.length}</Badge>
          )}
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Create Alert
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <AlertForm
              onSuccess={() => {
                setIsDialogOpen(false);
                loadAlerts();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No alerts configured. Create your first alert to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onDelete={deleteAlert}
              onTest={testAlert}
              onToggle={toggleAlert}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

interface AlertCardProps {
  alert: Alert;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
  onToggle: (id: string, isActive: boolean) => void;
}

function AlertCard({ alert, onDelete, onTest, onToggle }: AlertCardProps) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-semibold">{alert.name}</h4>
            {alert.isActive ? (
              <Badge variant="default" className="bg-green-500">Active</Badge>
            ) : (
              <Badge variant="secondary">Inactive</Badge>
            )}
          </div>

          {alert.description && (
            <p className="text-sm text-gray-600 mb-3">{alert.description}</p>
          )}

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Condition:</span>
              <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                {alert.condition.metric} {alert.condition.operator} {alert.condition.threshold}
              </code>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-gray-500">Channels:</span>
              <div className="flex gap-1">
                {alert.channels.map((channel) => (
                  <Badge key={channel} variant="outline" className="text-xs">
                    {channel}
                  </Badge>
                ))}
              </div>
            </div>

            {alert.lastTriggeredAt && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                Last triggered: {new Date(alert.lastTriggeredAt).toLocaleString()}
                {' '}({alert.triggerCount} times)
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          <Switch
            checked={alert.isActive}
            onCheckedChange={(checked) => onToggle(alert.id, checked)}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onTest(alert.id)}
            className="h-8 w-8 p-0"
          >
            <TestTube className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(alert.id)}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface AlertFormProps {
  onSuccess: () => void;
}

function AlertForm({ onSuccess }: AlertFormProps) {
  const [formData, setFormData] = useState<CreateAlertDto>({
    name: '',
    description: '',
    condition: {
      metric: '',
      operator: '>',
      threshold: 0,
    },
    channels: ['email'],
    emailRecipients: [],
    isActive: true,
  });
  const [emailInput, setEmailInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const addEmail = () => {
    if (emailInput && emailInput.includes('@')) {
      setFormData({
        ...formData,
        emailRecipients: [...(formData.emailRecipients || []), emailInput],
      });
      setEmailInput('');
    }
  };

  const removeEmail = (email: string) => {
    setFormData({
      ...formData,
      emailRecipients: formData.emailRecipients?.filter(e => e !== email),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await alertsApi.createAlert(formData);
      toast.success('Alert created successfully');
      onSuccess();
    } catch (error: unknown) {
      console.error('Failed to create alert:', error);
      toast.error('Failed to create alert');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Create Alert</DialogTitle>
        <DialogDescription>
          Set up a new alert to monitor your metrics
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Alert Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="High Budget Alert"
            required
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Notify when budget exceeds threshold"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1">
            <Label htmlFor="metric">Metric *</Label>
            <Input
              id="metric"
              value={formData.condition.metric}
              onChange={(e) => setFormData({
                ...formData,
                condition: { ...formData.condition, metric: e.target.value }
              })}
              placeholder="budgetUsage"
              required
            />
          </div>
          <div className="col-span-1">
            <Label htmlFor="operator">Operator *</Label>
            <Select
              value={formData.condition.operator}
              onValueChange={(value: '>' | '>=' | '<' | '<=' | '==' | '!=') => setFormData({
                ...formData,
                condition: { ...formData.condition, operator: value }
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=">">{'>'} Greater than</SelectItem>
                <SelectItem value=">=">{'>='} Greater or equal</SelectItem>
                <SelectItem value="<">{'<'} Less than</SelectItem>
                <SelectItem value="<=">{'<='} Less or equal</SelectItem>
                <SelectItem value="==">== Equal</SelectItem>
                <SelectItem value="!=">!= Not equal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-1">
            <Label htmlFor="threshold">Threshold *</Label>
            <Input
              id="threshold"
              type="number"
              step="0.01"
              value={formData.condition.threshold}
              onChange={(e) => setFormData({
                ...formData,
                condition: { ...formData.condition, threshold: parseFloat(e.target.value) }
              })}
              required
            />
          </div>
        </div>

        <div>
          <Label>Notification Channels *</Label>
          <div className="flex gap-2 mt-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.channels.includes('email')}
                onChange={(e) => {
                  const channels = e.target.checked
                    ? [...formData.channels, 'email']
                    : formData.channels.filter(c => c !== 'email');
                  setFormData({ ...formData, channels });
                }}
              />
              <span className="text-sm">Email</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.channels.includes('slack')}
                onChange={(e) => {
                  const channels = e.target.checked
                    ? [...formData.channels, 'slack']
                    : formData.channels.filter(c => c !== 'slack');
                  setFormData({ ...formData, channels });
                }}
              />
              <span className="text-sm">Slack</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.channels.includes('webhook')}
                onChange={(e) => {
                  const channels = e.target.checked
                    ? [...formData.channels, 'webhook']
                    : formData.channels.filter(c => c !== 'webhook');
                  setFormData({ ...formData, channels });
                }}
              />
              <span className="text-sm">Webhook</span>
            </label>
          </div>
        </div>

        {formData.channels.includes('email') && (
          <div>
            <Label htmlFor="email">Email Recipients</Label>
            <div className="flex gap-2">
              <Input
                id="email"
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="email@example.com"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())}
              />
              <Button type="button" onClick={addEmail} variant="outline">
                Add
              </Button>
            </div>
            {formData.emailRecipients && formData.emailRecipients.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.emailRecipients.map((email) => (
                  <Badge key={email} variant="secondary" className="gap-1">
                    {email}
                    <button
                      type="button"
                      onClick={() => removeEmail(email)}
                      className="ml-1 hover:text-red-600"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {formData.channels.includes('slack') && (
          <div>
            <Label htmlFor="slackWebhook">Slack Webhook URL</Label>
            <Input
              id="slackWebhook"
              value={formData.slackWebhook || ''}
              onChange={(e) => setFormData({ ...formData, slackWebhook: e.target.value })}
              placeholder="https://hooks.slack.com/services/..."
            />
          </div>
        )}

        {formData.channels.includes('webhook') && (
          <div>
            <Label htmlFor="webhookUrl">Webhook URL</Label>
            <Input
              id="webhookUrl"
              value={formData.webhookUrl || ''}
              onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
              placeholder="https://yourapi.com/webhook"
            />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create Alert'}
        </Button>
      </div>
    </form>
  );
}
