'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Key, Plus, Trash2, Eye, EyeOff, Copy, Shield } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface APIKey {
  id: string;
  name: string;
  key: string;
  prefix: string;
  permissions: string[];
  rateLimit: number;
  expiresAt: string | null;
  lastUsed: string | null;
  createdAt: string;
  enabled: boolean;
}

export default function APIKeysManager() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [newKey, setNewKey] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    permissions: [] as string[],
    rateLimit: 1000,
    expiresInDays: 0
  });

  const fetchAPIKeys = useCallback(async () => {
    try {
      const response = await fetch('/api/api-keys');
      const data = await response.json();
      setApiKeys(data);
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const response = await fetch('/api/api-keys');
        const data = await response.json();
        if (mounted) setApiKeys(data);
      } catch (error) {
        console.error('Failed to fetch API keys:', error);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      permissions: [],
      rateLimit: 1000,
      expiresInDays: 0
    });
  }, []);

  const createAPIKey = useCallback(async () => {
    try {
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      setNewKey(data.key);
      fetchAPIKeys();
      resetForm();
    } catch (error) {
      console.error('Failed to create API key:', error);
    }
  }, [formData, fetchAPIKeys, resetForm]);

  const deleteAPIKey = useCallback(async (id: string) => {
    try {
      await fetch(`/api/api-keys/${id}`, { method: 'DELETE' });
      fetchAPIKeys();
    } catch (error) {
      console.error('Failed to delete API key:', error);
    }
  }, [fetchAPIKeys]);

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };



  const availablePermissions = [
    'read:data',
    'write:data',
    'delete:data',
    'manage:users',
    'manage:settings',
    'access:api'
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Key className="h-8 w-8" />
            API Keys
          </h1>
          <p className="text-muted-foreground">Manage API keys for external integrations</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New API Key</DialogTitle>
            </DialogHeader>
            {newKey ? (
              <div className="space-y-4">
                <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200">
                  <div className="font-semibold text-sm mb-2">⚠️ Save this key securely</div>
                  <div className="text-sm text-muted-foreground mb-3">
                    This key will only be shown once. Make sure to copy it now.
                  </div>
                  <div className="flex gap-2">
                    <Input value={newKey} readOnly className="font-mono text-sm" />
                    <Button size="sm" onClick={() => copyToClipboard(newKey)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    setNewKey(null);
                    setIsDialogOpen(false);
                  }}
                >
                  Done
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label>Key Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Production API Key"
                  />
                </div>
                <div>
                  <Label>Rate Limit (requests/hour)</Label>
                  <Input
                    type="number"
                    value={formData.rateLimit}
                    onChange={(e) => setFormData({ ...formData, rateLimit: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Expires In (days, 0 for never)</Label>
                  <Input
                    type="number"
                    value={formData.expiresInDays}
                    onChange={(e) => setFormData({ ...formData, expiresInDays: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Permissions</Label>
                  <div className="space-y-2 mt-2">
                    {availablePermissions.map((perm) => (
                      <label key={perm} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.permissions.includes(perm)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, permissions: [...formData.permissions, perm] });
                            } else {
                              setFormData({
                                ...formData,
                                permissions: formData.permissions.filter(p => p !== perm)
                              });
                            }
                          }}
                        />
                        <span className="text-sm">{perm}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button onClick={createAPIKey}>Create Key</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {apiKeys.map((apiKey) => (
          <Card key={apiKey.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    {apiKey.name}
                  </CardTitle>
                  <CardDescription className="mt-1 font-mono text-xs">
                    {visibleKeys.has(apiKey.id) ? apiKey.key : `${apiKey.prefix}${'*'.repeat(32)}`}
                  </CardDescription>
                </div>
                <Badge variant={apiKey.enabled ? 'default' : 'secondary'}>
                  {apiKey.enabled ? 'Active' : 'Disabled'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  {apiKey.permissions.map((perm) => (
                    <Badge key={perm} variant="outline">{perm}</Badge>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Rate Limit:</span>
                    <span className="ml-2 font-semibold">{apiKey.rateLimit}/hour</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Used:</span>
                    <span className="ml-2">
                      {apiKey.lastUsed ? new Date(apiKey.lastUsed).toLocaleDateString() : 'Never'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created:</span>
                    <span className="ml-2">{new Date(apiKey.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Expires:</span>
                    <span className="ml-2">
                      {apiKey.expiresAt ? new Date(apiKey.expiresAt).toLocaleDateString() : 'Never'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleKeyVisibility(apiKey.id)}
                  >
                    {visibleKeys.has(apiKey.id) ? (
                      <><EyeOff className="h-3 w-3 mr-1" />Hide</>
                    ) : (
                      <><Eye className="h-3 w-3 mr-1" />Show</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(apiKey.key)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteAPIKey(apiKey.id)}
                  >
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
