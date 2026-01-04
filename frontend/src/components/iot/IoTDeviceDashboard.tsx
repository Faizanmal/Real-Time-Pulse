'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Wifi,
  WifiOff,
  AlertTriangle,
  Activity,
  MapPin,
  Settings,
  Power,
  RefreshCw,
  ChevronRight,
  Search,
  Filter,
  MoreVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface IoTDevice {
  id: string;
  name: string;
  deviceType: string;
  status: 'online' | 'offline' | 'warning' | 'error';
  lastSeen: string;
  metadata: Record<string, any>;
  telemetry: Record<string, any>;
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
  tags: string[];
}

interface IoTDeviceDashboardProps {
  workspaceId: string;
  className?: string;
}

const statusConfig = {
  online: {
    icon: Wifi,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    label: 'Online',
  },
  offline: {
    icon: WifiOff,
    color: 'text-slate-400',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/20',
    label: 'Offline',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    label: 'Warning',
  },
  error: {
    icon: AlertTriangle,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    label: 'Error',
  },
};

const deviceTypeIcons: Record<string, string> = {
  sensor: '📡',
  camera: '📷',
  thermostat: '🌡️',
  gateway: '🔗',
  actuator: '⚙️',
  meter: '📊',
  default: '📱',
};

export function IoTDeviceDashboard({ workspaceId, className }: IoTDeviceDashboardProps) {
  const [devices, setDevices] = useState<IoTDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<IoTDevice | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  // Fetch devices
  const fetchDevices = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (typeFilter) params.append('deviceType', typeFilter);

      const response = await fetch(`/api/iot/devices?${params}`);
      const data = await response.json();
      setDevices(data);
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchDevices]);

  // Filter devices
  const filteredDevices = devices.filter(device => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        device.name.toLowerCase().includes(query) ||
        device.deviceType.toLowerCase().includes(query) ||
        device.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    return true;
  });

  // Stats
  const stats = {
    total: devices.length,
    online: devices.filter(d => d.status === 'online').length,
    offline: devices.filter(d => d.status === 'offline').length,
    warning: devices.filter(d => d.status === 'warning' || d.status === 'error').length,
  };

  // Device types
  const deviceTypes = [...new Set(devices.map(d => d.deviceType))];

  // Send command
  const sendCommand = async (deviceId: string, command: string, payload: Record<string, any> = {}) => {
    try {
      await fetch(`/api/iot/devices/${deviceId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, payload }),
      });
      // Refresh device list
      fetchDevices();
    } catch (error) {
      console.error('Failed to send command:', error);
    }
  };

  if (isLoading) {
    return (
      <div className={cn('p-6 bg-slate-900 rounded-xl', className)}>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-slate-900 rounded-xl', className)}>
      {/* Header */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-white">IoT Devices</h2>
            <p className="text-sm text-slate-400 mt-1">
              Manage and monitor your connected devices
            </p>
          </div>
          <button
            onClick={fetchDevices}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-slate-800 rounded-lg">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-sm text-slate-400">Total Devices</div>
          </div>
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="text-2xl font-bold text-green-400">{stats.online}</div>
            <div className="text-sm text-green-400/70">Online</div>
          </div>
          <div className="p-4 bg-slate-500/10 border border-slate-500/20 rounded-lg">
            <div className="text-2xl font-bold text-slate-400">{stats.offline}</div>
            <div className="text-sm text-slate-400/70">Offline</div>
          </div>
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <div className="text-2xl font-bold text-yellow-400">{stats.warning}</div>
            <div className="text-sm text-yellow-400/70">Alerts</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search devices..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter || ''}
            onChange={e => setStatusFilter(e.target.value || null)}
            className="px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
          <select
            value={typeFilter || ''}
            onChange={e => setTypeFilter(e.target.value || null)}
            className="px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            {deviceTypes.map(type => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Device List */}
      <div className="divide-y divide-slate-700">
        {filteredDevices.length === 0 ? (
          <div className="p-8 text-center">
            <WifiOff className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-400">No devices found</p>
          </div>
        ) : (
          filteredDevices.map(device => {
            const status = statusConfig[device.status];
            const StatusIcon = status.icon;
            const deviceIcon = deviceTypeIcons[device.deviceType] || deviceTypeIcons.default;

            return (
              <div
                key={device.id}
                className={cn(
                  'p-4 hover:bg-slate-800/50 cursor-pointer transition-colors',
                  selectedDevice?.id === device.id && 'bg-slate-800'
                )}
                onClick={() => setSelectedDevice(device)}
              >
                <div className="flex items-center gap-4">
                  {/* Device Icon */}
                  <div
                    className={cn(
                      'w-12 h-12 rounded-lg flex items-center justify-center text-2xl',
                      status.bg,
                      status.border,
                      'border'
                    )}
                  >
                    {deviceIcon}
                  </div>

                  {/* Device Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-white truncate">{device.name}</h3>
                      <span
                        className={cn(
                          'px-2 py-0.5 text-xs rounded-full',
                          status.bg,
                          status.color
                        )}
                      >
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                      <span>{device.deviceType}</span>
                      {device.location?.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {device.location.address}
                        </span>
                      )}
                      <span>
                        Last seen: {new Date(device.lastSeen).toLocaleString()}
                      </span>
                    </div>
                    {device.tags.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {device.tags.slice(0, 3).map(tag => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                        {device.tags.length > 3 && (
                          <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-400 rounded">
                            +{device.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Telemetry Preview */}
                  {Object.keys(device.telemetry).length > 0 && (
                    <div className="hidden md:flex gap-4">
                      {Object.entries(device.telemetry).slice(0, 3).map(([key, value]) => (
                        <div key={key} className="text-center">
                          <div className="text-sm font-medium text-white">
                            {typeof value === 'number' ? value.toFixed(1) : value}
                          </div>
                          <div className="text-xs text-slate-500 capitalize">{key}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        sendCommand(device.id, 'ping', {});
                      }}
                      className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                      title="Ping device"
                    >
                      <Activity className="w-4 h-4" />
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedDevice(device);
                      }}
                      className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Device Details Panel */}
      {selectedDevice && (
        <div className="fixed inset-y-0 right-0 w-96 bg-slate-900 border-l border-slate-700 shadow-2xl z-50 overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">{selectedDevice.name}</h3>
              <button
                onClick={() => setSelectedDevice(null)}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400"
              >
                ✕
              </button>
            </div>

            {/* Status */}
            <div className="mb-6">
              <div
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-full',
                  statusConfig[selectedDevice.status].bg,
                  statusConfig[selectedDevice.status].border,
                  'border'
                )}
              >
                {React.createElement(statusConfig[selectedDevice.status].icon, {
                  className: cn('w-4 h-4', statusConfig[selectedDevice.status].color),
                })}
                <span className={cn('text-sm', statusConfig[selectedDevice.status].color)}>
                  {statusConfig[selectedDevice.status].label}
                </span>
              </div>
            </div>

            {/* Device Info */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs text-slate-500 uppercase">Device Type</label>
                <p className="text-white">{selectedDevice.deviceType}</p>
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase">Device ID</label>
                <p className="text-white font-mono text-sm">{selectedDevice.id}</p>
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase">Last Seen</label>
                <p className="text-white">{new Date(selectedDevice.lastSeen).toLocaleString()}</p>
              </div>
              {selectedDevice.location && (
                <div>
                  <label className="text-xs text-slate-500 uppercase">Location</label>
                  <p className="text-white">
                    {selectedDevice.location.address || 
                      `${selectedDevice.location.lat.toFixed(4)}, ${selectedDevice.location.lng.toFixed(4)}`}
                  </p>
                </div>
              )}
            </div>

            {/* Telemetry */}
            {Object.keys(selectedDevice.telemetry).length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-white mb-3">Live Telemetry</h4>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(selectedDevice.telemetry).map(([key, value]) => (
                    <div key={key} className="p-3 bg-slate-800 rounded-lg">
                      <div className="text-lg font-semibold text-white">
                        {typeof value === 'number' ? value.toFixed(2) : String(value)}
                      </div>
                      <div className="text-xs text-slate-400 capitalize">{key}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-white mb-3">Quick Actions</h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => sendCommand(selectedDevice.id, 'restart', {})}
                  className="p-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-sm transition-colors flex items-center gap-2"
                >
                  <Power className="w-4 h-4" />
                  Restart
                </button>
                <button
                  onClick={() => sendCommand(selectedDevice.id, 'ping', {})}
                  className="p-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-sm transition-colors flex items-center gap-2"
                >
                  <Activity className="w-4 h-4" />
                  Ping
                </button>
                <button
                  className="p-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-sm transition-colors flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  Configure
                </button>
                <button
                  className="p-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-sm transition-colors flex items-center gap-2"
                >
                  <Filter className="w-4 h-4" />
                  Set Alerts
                </button>
              </div>
            </div>

            {/* Metadata */}
            {Object.keys(selectedDevice.metadata).length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-white mb-3">Metadata</h4>
                <pre className="p-3 bg-slate-800 rounded-lg text-xs text-slate-300 overflow-x-auto">
                  {JSON.stringify(selectedDevice.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default IoTDeviceDashboard;
