'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ClipboardList,
  RefreshCw,
  Filter,
  Download,
  User,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  userId: string;
  userEmail?: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

interface AuditLogFilters {
  action?: string;
  entity?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AuditLogFilters>({ limit: 50 });
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.action) params.append('action', filters.action);
      if (filters.entity) params.append('entity', filters.entity);
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.limit) params.append('limit', String(filters.limit));
      if (filters.offset) params.append('offset', String(filters.offset));

      const response = await apiClient.get(`/audit?${params.toString()}`);
      setLogs(response.data);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'create':
        return 'bg-green-100 text-green-800';
      case 'update':
        return 'bg-blue-100 text-blue-800';
      case 'delete':
        return 'bg-red-100 text-red-800';
      case 'login':
        return 'bg-purple-100 text-purple-800';
      case 'logout':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const exportLogs = async () => {
    try {
      const csvContent = [
        ['Timestamp', 'Action', 'Entity', 'Entity ID', 'User', 'IP Address'].join(','),
        ...logs.map((log) =>
          [
            new Date(log.createdAt).toISOString(),
            log.action,
            log.entity,
            log.entityId,
            log.userEmail || log.userId,
            log.ipAddress || '',
          ].join(',')
        ),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <ClipboardList className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Audit Logs</h2>
            <p className="text-sm text-gray-600">Track all system activities and changes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <Button variant="outline" size="sm" onClick={exportLogs}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Action</label>
              <select
                className="w-full px-3 py-2 border rounded-lg"
                value={filters.action || ''}
                onChange={(e) => setFilters({ ...filters, action: e.target.value || undefined })}
              >
                <option value="">All Actions</option>
                <option value="CREATE">Create</option>
                <option value="UPDATE">Update</option>
                <option value="DELETE">Delete</option>
                <option value="LOGIN">Login</option>
                <option value="LOGOUT">Logout</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Entity</label>
              <Input
                placeholder="e.g., portal, widget"
                value={filters.entity || ''}
                onChange={(e) => setFilters({ ...filters, entity: e.target.value || undefined })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">User ID</label>
              <Input
                placeholder="Filter by user"
                value={filters.userId || ''}
                onChange={(e) => setFilters({ ...filters, userId: e.target.value || undefined })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Results</label>
              <select
                className="w-full px-3 py-2 border rounded-lg"
                value={filters.limit || 50}
                onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value) })}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
          </div>
        </Card>
      )}

      {/* Logs List */}
      <Card className="divide-y">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            <p className="mt-2 text-gray-600">Loading audit logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-gray-300" />
            <p className="mt-2 text-gray-600">No audit logs found</p>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="p-4 hover:bg-gray-50">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
              >
                <div className="flex items-center gap-4">
                  <Badge className={getActionColor(log.action)}>{log.action}</Badge>
                  <div>
                    <span className="font-medium">{log.entity}</span>
                    <span className="text-gray-400 mx-2">→</span>
                    <code className="text-sm bg-gray-100 px-2 py-0.5 rounded">
                      {log.entityId.slice(0, 8)}...
                    </code>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-600 flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {log.userEmail || log.userId.slice(0, 8)}
                  </div>
                  <div className="text-sm text-gray-500 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                  {expandedLog === log.id ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </div>
              
              {expandedLog === log.id && (
                <div className="mt-4 pl-4 border-l-2 border-gray-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Entity ID:</span>
                      <code className="ml-2 bg-gray-100 px-2 py-0.5 rounded">{log.entityId}</code>
                    </div>
                    <div>
                      <span className="text-gray-500">User ID:</span>
                      <code className="ml-2 bg-gray-100 px-2 py-0.5 rounded">{log.userId}</code>
                    </div>
                    {log.ipAddress && (
                      <div>
                        <span className="text-gray-500">IP Address:</span>
                        <span className="ml-2">{log.ipAddress}</span>
                      </div>
                    )}
                    {log.userAgent && (
                      <div className="col-span-2">
                        <span className="text-gray-500">User Agent:</span>
                        <span className="ml-2 text-xs">{log.userAgent}</span>
                      </div>
                    )}
                    {log.changes && Object.keys(log.changes).length > 0 && (
                      <div className="col-span-2">
                        <span className="text-gray-500 block mb-2">Changes:</span>
                        <pre className="bg-gray-100 p-3 rounded-lg text-xs overflow-auto">
                          {JSON.stringify(log.changes, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </Card>

      {/* Pagination */}
      {logs.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">
            Showing {logs.length} of {logs.length}+ records
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!filters.offset || filters.offset === 0}
              onClick={() =>
                setFilters({
                  ...filters,
                  offset: Math.max(0, (filters.offset || 0) - (filters.limit || 50)),
                })
              }
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={logs.length < (filters.limit || 50)}
              onClick={() =>
                setFilters({
                  ...filters,
                  offset: (filters.offset || 0) + (filters.limit || 50),
                })
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
