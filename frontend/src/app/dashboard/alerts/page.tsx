'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { alertsApi, type Alert, type AlertHistory, type CreateAlertDto } from '@/lib/api/index';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Bell, Plus, Trash2, Edit2, Play, History, AlertTriangle, 
  CheckCircle, XCircle, Clock, TrendingUp, TrendingDown 
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const severityColors = {
  LOW: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const typeIcons = {
  THRESHOLD: TrendingUp,
  ANOMALY: AlertTriangle,
  TREND: TrendingDown,
  CUSTOM: Bell,
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [history, setHistory] = useState<AlertHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const loadAlerts = useCallback(async () => {
    try {
      const data = await alertsApi.getAll();
      setAlerts(data);
    } catch (error) {
      console.error('Failed to load alerts:', error);
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleToggleAlert = async (alert: Alert) => {
    try {
      await alertsApi.update(alert.id, { enabled: !alert.enabled });
      setAlerts(alerts.map(a => 
        a.id === alert.id ? { ...a, enabled: !a.enabled } : a
      ));
      toast.success(`Alert ${!alert.enabled ? 'enabled' : 'disabled'}`);
    } catch {
      toast.error('Failed to update alert');
    }
  };

  const handleDeleteAlert = async (id: string) => {
    if (!confirm('Are you sure you want to delete this alert?')) return;
    try {
      await alertsApi.delete(id);
      setAlerts(alerts.filter(a => a.id !== id));
      toast.success('Alert deleted');
    } catch {
      toast.error('Failed to delete alert');
    }
  };

  const handleTestAlert = async (id: string) => {
    try {
      const result = await alertsApi.test(id);
      if (result.success) {
        toast.success('Test alert sent successfully');
      } else {
        toast.error(result.message || 'Test failed');
      }
    } catch {
      toast.error('Failed to test alert');
    }
  };

  const handleViewHistory = async (alert: Alert) => {
    setSelectedAlert(alert);
    setHistoryLoading(true);
    try {
      const data = await alertsApi.getHistory(alert.id);
      setHistory(data);
    } catch {
      toast.error('Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleCreateAlert = async (data: CreateAlertDto) => {
    try {
      const newAlert = await alertsApi.create(data);
      setAlerts([newAlert, ...alerts]);
      setShowCreateDialog(false);
      toast.success('Alert created successfully');
    } catch {
      toast.error('Failed to create alert');
    }
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
            <Bell className="h-8 w-8 text-purple-500" />
            Alerts Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure and manage your alert rules and notifications
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Alert
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Alert</DialogTitle>
            </DialogHeader>
            <CreateAlertForm onSubmit={handleCreateAlert} onCancel={() => setShowCreateDialog(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Alerts</p>
                <p className="text-2xl font-bold">{alerts.length}</p>
              </div>
              <Bell className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-600">
                  {alerts.filter(a => a.enabled).length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Disabled</p>
                <p className="text-2xl font-bold text-gray-500">
                  {alerts.filter(a => !a.enabled).length}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold text-red-600">
                  {alerts.filter(a => a.severity === 'CRITICAL').length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts List */}
      <Card>
        <CardHeader>
          <CardTitle>Alert Rules</CardTitle>
          <CardDescription>Manage your notification rules and thresholds</CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No alerts configured yet</p>
              <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                Create your first alert
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {alerts.map((alert) => {
                  const TypeIcon = typeIcons[alert.type];
                  return (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${alert.enabled ? 'bg-purple-100 dark:bg-purple-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
                          <TypeIcon className={`h-5 w-5 ${alert.enabled ? 'text-purple-600' : 'text-gray-400'}`} />
                        </div>
                        <div>
                          <h3 className="font-medium">{alert.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {alert.metric} {alert.condition.operator} {alert.condition.value}
                          </p>
                          {alert.lastTriggeredAt && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <Clock className="h-3 w-3" />
                              Last triggered: {new Date(alert.lastTriggeredAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge className={severityColors[alert.severity]}>
                          {alert.severity}
                        </Badge>
                        <div className="flex items-center gap-2">
                          {alert.channels.map(channel => (
                            <Badge key={channel} variant="outline" className="text-xs">
                              {channel}
                            </Badge>
                          ))}
                        </div>
                        <Switch 
                          checked={alert.enabled} 
                          onCheckedChange={() => handleToggleAlert(alert)}
                        />
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" onClick={() => handleTestAlert(alert.id)}>
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleViewHistory(alert)}>
                            <History className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDeleteAlert(alert.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Dialog */}
      <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Alert History: {selectedAlert?.name}</DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No trigger history</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {history.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">Value: {item.value}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(item.triggeredAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={item.status === 'RESOLVED' ? 'default' : 'destructive'}>
                    {item.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Create Alert Form Component
function CreateAlertForm({ 
  onSubmit, 
  onCancel 
}: { 
  onSubmit: (data: CreateAlertDto) => void; 
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<CreateAlertDto>({
    name: '',
    type: 'THRESHOLD',
    metric: '',
    condition: { operator: 'gt', value: 0 },
    severity: 'MEDIUM',
    channels: ['EMAIL'],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Alert Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="High CPU Usage Alert"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Type</Label>
          <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as CreateAlertDto['type'] })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="THRESHOLD">Threshold</SelectItem>
              <SelectItem value="ANOMALY">Anomaly</SelectItem>
              <SelectItem value="TREND">Trend</SelectItem>
              <SelectItem value="CUSTOM">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Severity</Label>
          <Select value={formData.severity} onValueChange={(v) => setFormData({ ...formData, severity: v as CreateAlertDto['severity'] })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="metric">Metric</Label>
        <Input
          id="metric"
          value={formData.metric}
          onChange={(e) => setFormData({ ...formData, metric: e.target.value })}
          placeholder="cpu_usage, memory_percent, etc."
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Operator</Label>
          <Select 
            value={formData.condition.operator} 
            onValueChange={(v) => setFormData({ 
              ...formData, 
              condition: { ...formData.condition, operator: v as CreateAlertDto['condition']['operator'] } 
            })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gt">Greater than</SelectItem>
              <SelectItem value="lt">Less than</SelectItem>
              <SelectItem value="eq">Equals</SelectItem>
              <SelectItem value="gte">Greater or equal</SelectItem>
              <SelectItem value="lte">Less or equal</SelectItem>
              <SelectItem value="ne">Not equal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="value">Threshold Value</Label>
          <Input
            id="value"
            type="number"
            value={formData.condition.value}
            onChange={(e) => setFormData({ 
              ...formData, 
              condition: { ...formData.condition, value: Number(e.target.value) } 
            })}
            required
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Create Alert</Button>
      </div>
    </form>
  );
}
