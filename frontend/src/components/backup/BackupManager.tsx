'use client';

import React, { useState } from 'react';
import { Database, Download, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface BackupManagerProps {
  workspaceId: string;
}

export function BackupManager({ workspaceId }: BackupManagerProps) {
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/backups', {
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      setBackups(data);
    } catch (error) {
      console.error('Failed to load backups', error);
    } finally {
      setLoading(false);
    }
  };

  const createBackup = async () => {
    setCreating(true);
    try {
      await fetch('/api/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'full', description: 'Manual backup' }),
      });
      await loadBackups();
    } catch (error) {
      console.error('Failed to create backup', error);
    } finally {
      setCreating(false);
    }
  };

  const restoreBackup = async (backupId: string) => {
    if (!confirm('Are you sure you want to restore this backup? This will overwrite current data.')) {
      return;
    }

    try {
      await fetch(`/api/backups/${backupId}/restore`, {
        method: 'POST',
      });
      alert('Backup restored successfully');
    } catch (error) {
      console.error('Failed to restore backup', error);
      alert('Failed to restore backup');
    }
  };

  React.useEffect(() => {
    loadBackups();
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Database className="w-5 h-5" />
          Data Backups
        </h2>
        <button
          onClick={createBackup}
          disabled={creating}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          {creating ? 'Creating...' : 'Create Backup'}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading backups...</div>
      ) : (
        <div className="space-y-3">
          {backups.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No backups found. Create your first backup to protect your data.
            </div>
          ) : (
            backups.map((backup) => (
              <div
                key={backup.id}
                className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <div className="flex items-center gap-4">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {backup.type === 'full' ? 'Full Backup' : 'Incremental Backup'}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Clock className="w-3 h-3" />
                      {new Date(backup.timestamp).toLocaleString()}
                    </div>
                    <p className="text-xs text-gray-400">
                      Size: {(backup.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => restoreBackup(backup.id)}
                  className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Restore
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">Automated Backups</p>
            <p>Daily backups are automatically created at 2:00 AM. Backups are encrypted and replicated across regions for maximum safety.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
