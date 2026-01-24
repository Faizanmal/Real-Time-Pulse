'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Share2, Copy, ExternalLink, Trash2, Calendar, Eye, Lock, Unlock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ShareLink {
  id: string;
  name: string;
  url: string;
  resourceType: string;
  resourceId: string;
  accessLevel: 'view' | 'edit' | 'admin';
  expiresAt: string | null;
  password: string | null;
  views: number;
  maxViews: number | null;
  createdAt: string;
  createdBy: string;
  enabled: boolean;
}

export default function ShareLinksManagement() {
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    resourceType: 'dashboard',
    resourceId: '',
    accessLevel: 'view' as 'view' | 'edit' | 'admin',
    expiresInDays: 0,
    password: '',
    maxViews: 0,
    enabled: true
  });

  const fetchShareLinks = useCallback(async () => {
    try {
      const response = await fetch('/api/share-links');
      const data = await response.json();
      setShareLinks(data);
    } catch (error) {
      console.error('Failed to fetch share links:', error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const response = await fetch('/api/share-links');
        const data = await response.json();
        if (mounted) setShareLinks(data);
      } catch (error) {
        console.error('Failed to fetch share links:', error);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      resourceType: 'dashboard',
      resourceId: '',
      accessLevel: 'view',
      expiresInDays: 0,
      password: '',
      maxViews: 0,
      enabled: true
    });
  }, []);

  const createShareLink = useCallback(async () => {
    try {
      const response = await fetch('/api/share-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      fetchShareLinks();
      setIsDialogOpen(false);
      resetForm();
      copyToClipboard(data.url);
    } catch (error) {
      console.error('Failed to create share link:', error);
    }
  }, [formData, fetchShareLinks, copyToClipboard, resetForm]);

  const deleteShareLink = useCallback(async (id: string) => {
    try {
      await fetch(`/api/share-links/${id}`, { method: 'DELETE' });
      fetchShareLinks();
    } catch (error) {
      console.error('Failed to delete share link:', error);
    }
  }, [fetchShareLinks]);

  const toggleShareLink = useCallback(async (id: string, enabled: boolean) => {
    try {
      await fetch(`/api/share-links/${id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      fetchShareLinks();
    } catch (error) {
      console.error('Failed to toggle share link:', error);
    }
  }, [fetchShareLinks]);

  const resourceTypes = ['dashboard', 'report', 'chart', 'dataset'];
  const accessLevels = ['view', 'edit', 'admin'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Share2 className="h-8 w-8" />
            Share Links
          </h1>
          <p className="text-muted-foreground">Create and manage secure share links</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Share2 className="h-4 w-4 mr-2" />
              Create Share Link
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Share Link</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Link Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Q4 Dashboard Share"
                />
              </div>
              <div>
                <Label>Resource Type</Label>
                <Select value={formData.resourceType} onValueChange={(value) => setFormData({ ...formData, resourceType: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {resourceTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Resource ID</Label>
                <Input
                  value={formData.resourceId}
                  onChange={(e) => setFormData({ ...formData, resourceId: e.target.value })}
                  placeholder="dashboard-123"
                />
              </div>
              <div>
                <Label>Access Level</Label>
                <Select value={formData.accessLevel} onValueChange={(value: string) => setFormData({ ...formData, accessLevel: value as 'view' | 'edit' | 'admin' })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accessLevels.map(level => (
                      <SelectItem key={level} value={level}>{level}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Expires In Days (0 for never)</Label>
                <Input
                  type="number"
                  value={formData.expiresInDays}
                  onChange={(e) => setFormData({ ...formData, expiresInDays: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label>Password Protection (optional)</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Leave empty for no password"
                />
              </div>
              <div>
                <Label>Max Views (0 for unlimited)</Label>
                <Input
                  type="number"
                  value={formData.maxViews}
                  onChange={(e) => setFormData({ ...formData, maxViews: parseInt(e.target.value) })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                />
                <Label htmlFor="enabled">Link Enabled</Label>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={createShareLink}>Create Link</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{shareLinks.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {shareLinks.filter(l => l.enabled).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {shareLinks.reduce((acc, l) => acc + l.views, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Protected Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {shareLinks.filter(l => l.password).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {shareLinks.map((link) => (
          <Card key={link.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {link.password ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                    {link.name}
                  </CardTitle>
                  <CardDescription className="mt-1 font-mono text-xs">
                    {link.url}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={link.enabled ? 'default' : 'secondary'}>
                    {link.enabled ? 'Active' : 'Disabled'}
                  </Badge>
                  <Switch
                    checked={link.enabled}
                    onCheckedChange={(checked) => toggleShareLink(link.id, checked)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Type:</span>
                    <Badge variant="outline" className="ml-2">{link.resourceType}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Access:</span>
                    <Badge variant="outline" className="ml-2">{link.accessLevel}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="h-3 w-3 text-muted-foreground" />
                    <span>{link.views}</span>
                    {link.maxViews && <span className="text-muted-foreground">/ {link.maxViews}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs">
                      {link.expiresAt ? `Expires: ${new Date(link.expiresAt).toLocaleDateString()}` : 'Never expires'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(link.url)}>
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={link.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Open
                    </a>
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteShareLink(link.id)}>
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
