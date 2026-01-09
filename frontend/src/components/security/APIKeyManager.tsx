'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '@/lib/api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Key, Plus, Trash2, Copy, Calendar, Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface APIKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

interface NewKeyResponse {
  id: string;
  name: string;
  key: string; // Full key - only shown once
  keyPrefix: string;
  scopes: string[];
  expiresAt: string | null;
}

interface APIKeyManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AVAILABLE_SCOPES = [
  { value: 'read:portals', label: 'Read Portals' },
  { value: 'write:portals', label: 'Write Portals' },
  { value: 'read:widgets', label: 'Read Widgets' },
  { value: 'write:widgets', label: 'Write Widgets' },
  { value: 'read:analytics', label: 'Read Analytics' },
  { value: 'read:integrations', label: 'Read Integrations' },
  { value: 'write:integrations', label: 'Write Integrations' },
  { value: 'read:exports', label: 'Read Exports' },
  { value: 'write:exports', label: 'Write Exports' },
];

export function APIKeyManager({ open, onOpenChange }: APIKeyManagerProps) {
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKey, setNewKey] = useState<NewKeyResponse | null>(null);
  const [showNewKey, setShowNewKey] = useState(false);

  // Create form state
  const [keyName, setKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [expiresIn, setExpiresIn] = useState<string>('never');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (open) {
      loadKeys();
    }
  }, [open]);

  const loadKeys = async () => {
    try {
      const response = await apiClient.get('/api-keys');
      setKeys(response.data);
    } catch (error) {
      console.error('Failed to load API keys:', error);
      toast.error('Failed to load API keys');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!keyName.trim()) {
      toast.error('Please enter a key name');
      return;
    }

    if (selectedScopes.length === 0) {
      toast.error('Please select at least one scope');
      return;
    }

    setIsCreating(true);

    try {
      const expiresAt = expiresIn === 'never' ? null : calculateExpiry(expiresIn);
      
      const response = await apiClient.post('/api-keys', {
        name: keyName,
        scopes: selectedScopes,
        expiresAt,
      });

      setNewKey(response.data);
      setShowNewKey(true);
      setShowCreateDialog(false);
      setKeyName('');
      setSelectedScopes([]);
      setExpiresIn('never');
      loadKeys();
      toast.success('API key created successfully');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error && 'response' in error 
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message 
        : 'Failed to create API key';
      console.error('Failed to create API key:', error);
      toast.error(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return;
    }

    try {
      await apiClient.delete(`/api-keys/${keyId}`);
      setKeys(keys.filter((k) => k.id !== keyId));
      toast.success('API key deleted');
    } catch (error) {
      console.error('Failed to delete API key:', error);
      toast.error('Failed to delete API key');
    }
  };

  const handleCopyKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey.key);
      toast.success('API key copied to clipboard');
    }
  };

  const calculateExpiry = (period: string): string => {
    const now = new Date();
    switch (period) {
      case '30days':
        now.setDate(now.getDate() + 30);
        break;
      case '90days':
        now.setDate(now.getDate() + 90);
        break;
      case '1year':
        now.setFullYear(now.getFullYear() + 1);
        break;
    }
    return now.toISOString();
  };

  const toggleScope = (scope: string) => {
    if (selectedScopes.includes(scope)) {
      setSelectedScopes(selectedScopes.filter((s) => s !== scope));
    } else {
      setSelectedScopes([...selectedScopes, scope]);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-slate-900 border-slate-700 text-white max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Key className="h-5 w-5 text-purple-400" />
            API Keys
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Manage API keys for programmatic access to your workspace
          </DialogDescription>
        </DialogHeader>

        {/* New Key Display */}
        <AnimatePresence>
          {newKey && showNewKey && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-4 bg-green-900/20 border border-green-600/30 rounded-lg mb-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-green-400">Your new API key</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewKey(false)}
                  className="text-gray-400 hover:text-white"
                >
                  Dismiss
                </Button>
              </div>
              <p className="text-sm text-gray-400 mb-3">
                Make sure to copy this key now. You won&apos;t be able to see it again!
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-3 bg-slate-800 rounded-lg font-mono text-sm text-green-300 break-all">
                  {newKey.key}
                </code>
                <Button
                  onClick={handleCopyKey}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create Key Button */}
        <div className="flex justify-end mb-4">
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Key
          </Button>
        </div>

        {/* Keys List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : keys.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No API keys yet</p>
            <p className="text-sm">Create your first API key to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((key) => (
              <motion.div
                key={key.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-slate-800/50 rounded-lg border border-slate-700"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium text-white">{key.name}</h4>
                      <code className="text-xs px-2 py-0.5 bg-slate-700 rounded text-gray-400">
                        {key.keyPrefix}...
                      </code>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {key.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="text-xs px-2 py-0.5 bg-purple-900/30 text-purple-300 rounded"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Created: {formatDate(key.createdAt)}
                      </span>
                      {key.expiresAt && (
                        <span className="flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          Expires: {formatDate(key.expiresAt)}
                        </span>
                      )}
                      {key.lastUsedAt && (
                        <span>Last used: {formatDate(key.lastUsedAt)}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteKey(key.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Create Key Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle className="text-white">Create API Key</DialogTitle>
              <DialogDescription className="text-gray-400">
                Create a new API key with specific permissions
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="keyName" className="text-gray-300">Key Name</Label>
                <Input
                  id="keyName"
                  placeholder="My API Key"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">Scopes</Label>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_SCOPES.map((scope) => (
                    <label
                      key={scope.value}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                        selectedScopes.includes(scope.value)
                          ? 'bg-purple-900/30 border-purple-600 text-purple-300'
                          : 'bg-slate-800/50 border-slate-700 text-gray-400 hover:border-slate-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedScopes.includes(scope.value)}
                        onChange={() => toggleScope(scope.value)}
                        className="sr-only"
                      />
                      <span className="text-sm">{scope.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiry" className="text-gray-300">Expiration</Label>
                <Select value={expiresIn} onValueChange={setExpiresIn}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Select expiration" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    <SelectItem value="never">Never expire</SelectItem>
                    <SelectItem value="30days">30 days</SelectItem>
                    <SelectItem value="90days">90 days</SelectItem>
                    <SelectItem value="1year">1 year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                  className="flex-1 border-slate-700 text-gray-300 hover:bg-slate-800"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateKey}
                  disabled={isCreating}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Key
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
