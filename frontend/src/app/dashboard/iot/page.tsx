'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { iotApi, type IoTDevice, type IoTMetric, type IoTAlert, type EdgeNode } from '@/lib/api/index';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Cpu, Wifi, WifiOff, Plus, RefreshCw, Trash2, Activity,
  Thermometer, Battery, Signal, AlertTriangle, CheckCircle2,
  Server, Clock, MapPin
} from 'lucide-react';
import { toast } from 'sonner';

const statusColors = {
  online: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  offline: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

export default function IoTPage() {
  const [devices, setDevices] = useState<IoTDevice[]>([]);
  const [alerts, setAlerts] = useState<IoTAlert[]>([]);
  const [edgeNodes, setEdgeNodes] = useState<EdgeNode[]>([]);
  const [selectedDeviceMetrics, setSelectedDeviceMetrics] = useState<IoTMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [metricsDialogOpen, setMetricsDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<IoTDevice | null>(null);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('sensor');
  const [formLocation, setFormLocation] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [devicesData, alertsData, edgeData] = await Promise.all([
        iotApi.getDevices(),
        iotApi.getAlerts(),
        iotApi.getEdgeNodes(),
      ]);
      setDevices(devicesData);
      setAlerts(alertsData);
      setEdgeNodes(edgeData);
    } catch (error) {
      console.error('Failed to load IoT data:', error);
      toast.error('Failed to load IoT data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setFormName('');
    setFormType('sensor');
    setFormLocation('');
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Please enter a device name');
      return;
    }

    setSaving(true);
    try {
      await iotApi.registerDevice({
        name: formName,
        type: formType,
        location: formLocation || undefined,
      });
      toast.success('Device registered');
      setCreateDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Registration failed:', error);
      toast.error('Failed to register device');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this device?')) return;

    try {
      await iotApi.deleteDevice(id);
      toast.success('Device removed');
      loadData();
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Failed to remove device');
    }
  };

  const viewMetrics = async (device: IoTDevice) => {
    setSelectedDevice(device);
    try {
      const metrics = await iotApi.getDeviceMetrics(device.id);
      setSelectedDeviceMetrics(metrics);
      setMetricsDialogOpen(true);
    } catch (error) {
      console.error('Failed to load metrics:', error);
      toast.error('Failed to load device metrics');
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await iotApi.acknowledgeAlert(alertId);
      toast.success('Alert acknowledged');
      loadData();
    } catch (error) {
      console.error('Acknowledge failed:', error);
      toast.error('Failed to acknowledge alert');
    }
  };

  const stats = {
    total: devices.length,
    online: devices.filter(d => d.status === 'online').length,
    offline: devices.filter(d => d.status === 'offline').length,
    alerts: alerts.filter(a => !a.acknowledged).length,
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
            <Cpu className="h-8 w-8 text-purple-500" />
            IoT Device Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage your connected devices
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Register Device
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register New Device</DialogTitle>
                <DialogDescription>
                  Add a new IoT device to your network
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Device Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Temperature Sensor - Building A"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Device Type</Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sensor">Sensor</SelectItem>
                      <SelectItem value="actuator">Actuator</SelectItem>
                      <SelectItem value="gateway">Gateway</SelectItem>
                      <SelectItem value="controller">Controller</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Location (optional)
                  </Label>
                  <Input
                    id="location"
                    placeholder="e.g., Floor 2, Room 203"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
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
                      Registering...
                    </>
                  ) : (
                    'Register'
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
                <p className="text-sm text-muted-foreground">Total Devices</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Cpu className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Online</p>
                <p className="text-2xl font-bold">{stats.online}</p>
              </div>
              <Wifi className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Offline</p>
                <p className="text-2xl font-bold">{stats.offline}</p>
              </div>
              <WifiOff className="h-8 w-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Alerts</p>
                <p className="text-2xl font-bold">{stats.alerts}</p>
              </div>
              <AlertTriangle className={`h-8 w-8 ${stats.alerts > 0 ? 'text-red-500 animate-pulse' : 'text-gray-400'}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="devices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="alerts" className="relative">
            Alerts
            {stats.alerts > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                {stats.alerts}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="edge">Edge Nodes</TabsTrigger>
        </TabsList>

        <TabsContent value="devices">
          <Card>
            <CardHeader>
              <CardTitle>Connected Devices</CardTitle>
              <CardDescription>All registered IoT devices</CardDescription>
            </CardHeader>
            <CardContent>
              {devices.length === 0 ? (
                <div className="text-center py-12">
                  <Cpu className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No devices registered</h3>
                  <p className="text-muted-foreground mb-4">Register your first IoT device</p>
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Register Device
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <AnimatePresence>
                    {devices.map((device, index) => (
                      <motion.div
                        key={device.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className="hover:shadow-md transition-shadow">
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${statusColors[device.status as keyof typeof statusColors] || statusColors.offline}`}>
                                  {device.status === 'online' ? (
                                    <Wifi className="h-5 w-5" />
                                  ) : (
                                    <WifiOff className="h-5 w-5" />
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium">{device.name}</p>
                                  <p className="text-xs text-muted-foreground capitalize">{device.type}</p>
                                </div>
                              </div>
                              <Badge className={statusColors[device.status as keyof typeof statusColors]}>
                                {device.status}
                              </Badge>
                            </div>
                            
                            {device.location && (
                              <p className="text-sm text-muted-foreground flex items-center gap-1 mb-3">
                                <MapPin className="h-3 w-3" />
                                {device.location}
                              </p>
                            )}

                            {device.lastSeen && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mb-3">
                                <Clock className="h-3 w-3" />
                                Last seen: {new Date(device.lastSeen).toLocaleString()}
                              </p>
                            )}

                            {device.battery !== undefined && (
                              <div className="mb-3">
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="flex items-center gap-1">
                                    <Battery className="h-3 w-3" />
                                    Battery
                                  </span>
                                  <span>{device.battery}%</span>
                                </div>
                                <Progress value={device.battery} className="h-1" />
                              </div>
                            )}

                            {device.signalStrength !== undefined && (
                              <div className="mb-4">
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="flex items-center gap-1">
                                    <Signal className="h-3 w-3" />
                                    Signal
                                  </span>
                                  <span>{device.signalStrength}%</span>
                                </div>
                                <Progress value={device.signalStrength} className="h-1" />
                              </div>
                            )}

                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" className="flex-1" onClick={() => viewMetrics(device)}>
                                <Activity className="h-3 w-3 mr-1" />
                                Metrics
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(device.id)} className="text-red-500 hover:text-red-600">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>Device Alerts</CardTitle>
              <CardDescription>Active and recent alerts from your devices</CardDescription>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-medium mb-2">All systems operational</h3>
                  <p className="text-muted-foreground">No active alerts</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div 
                      key={alert.id} 
                      className={`flex items-center justify-between p-4 rounded-lg border ${alert.acknowledged ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          alert.severity === 'critical' ? 'bg-red-100 dark:bg-red-900' :
                          alert.severity === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900' :
                          'bg-blue-100 dark:bg-blue-900'
                        }`}>
                          <AlertTriangle className={`h-5 w-5 ${
                            alert.severity === 'critical' ? 'text-red-600' :
                            alert.severity === 'warning' ? 'text-yellow-600' :
                            'text-blue-600'
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium">{alert.message}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <span>Device: {alert.deviceName || alert.deviceId}</span>
                            <span>•</span>
                            <span>{new Date(alert.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                          {alert.severity}
                        </Badge>
                        {!alert.acknowledged && (
                          <Button variant="outline" size="sm" onClick={() => handleAcknowledgeAlert(alert.id)}>
                            Acknowledge
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="edge">
          <Card>
            <CardHeader>
              <CardTitle>Edge Nodes</CardTitle>
              <CardDescription>Edge computing nodes in your network</CardDescription>
            </CardHeader>
            <CardContent>
              {edgeNodes.length === 0 ? (
                <div className="text-center py-12">
                  <Server className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No edge nodes</h3>
                  <p className="text-muted-foreground">Edge nodes will appear here once configured</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {edgeNodes.map((node) => (
                    <Card key={node.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <Server className="h-8 w-8 text-purple-500" />
                            <div>
                              <p className="font-medium">{node.name}</p>
                              <p className="text-xs text-muted-foreground">{node.location}</p>
                            </div>
                          </div>
                          <Badge className={statusColors[node.status as keyof typeof statusColors]}>
                            {node.status}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>CPU Usage</span>
                            <span>{node.cpuUsage}%</span>
                          </div>
                          <Progress value={node.cpuUsage} className="h-1" />
                          <div className="flex justify-between text-sm">
                            <span>Memory</span>
                            <span>{node.memoryUsage}%</span>
                          </div>
                          <Progress value={node.memoryUsage} className="h-1" />
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Connected Devices</span>
                            <span>{node.connectedDevices}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Metrics Dialog */}
      <Dialog open={metricsDialogOpen} onOpenChange={setMetricsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Device Metrics - {selectedDevice?.name}</DialogTitle>
            <DialogDescription>
              Real-time and historical metrics
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {selectedDeviceMetrics.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No metrics available</p>
            ) : (
              <div className="space-y-3">
                {selectedDeviceMetrics.map((metric, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Thermometer className="h-5 w-5 text-purple-500" />
                      <div>
                        <p className="font-medium">{metric.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(metric.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{metric.value}</p>
                      <p className="text-xs text-muted-foreground">{metric.unit}</p>
                    </div>
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
