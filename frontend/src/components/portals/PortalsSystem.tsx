'use client';

import { Layout, Plus, Eye, Edit, Trash2 } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { portalsApi } from '@/lib/api/index';
import type { Portal } from '@/lib/api/portals';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// import { Input } from '@/components/ui/input';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function PortalsSystem() {
  const [portals, setPortals] = useState<Portal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await portalsApi.getPortals();
        if (mounted) setPortals(response.portals);
      } catch (error) {
        if (mounted) setError(error instanceof Error ? error.message : 'Portals could not be loaded.');
        console.error('Failed to fetch portals:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const fetchPortals = async () => {
    try {
      const response = await portalsApi.getPortals();
      setPortals(response.portals);
      setError('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Portals could not be loaded.');
      console.error('Failed to fetch portals:', error);
    } finally {
      setLoading(false);
    }
  };

  const createPortal = async () => {
    window.location.href = '/dashboard/portals/new';
  };

  if (loading) return <main aria-busy="true" className="mx-auto max-w-5xl p-8">Loading portals…</main>;

  const deletePortal = async (id: string) => {
    try {
      await fetch(`/api/portals/${id}`, { method: 'DELETE' });
      fetchPortals();
    } catch (error) {
      console.error('Failed to delete portal:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Layout className="h-8 w-8" />
            Portals
          </h1>
          <p className="text-muted-foreground">Create custom client and team portals</p>
        </div>
        <Button onClick={createPortal}>
          <Plus className="h-4 w-4 mr-2" />
          Create Portal
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Portals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{portals.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {portals.filter(p => p.publishedAt || (!p.draftMode && p.isPublic)).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Widgets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {portals.reduce((acc, p) => acc + (p.widgetCount ?? 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-900">
        <p>{error}</p><Button className="mt-3" variant="outline" onClick={() => void fetchPortals()}>Retry</Button>
      </div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {portals.length === 0 && !error ? <p className="text-muted-foreground">No portals yet. Create one or start with the fictional demo portal.</p> : portals.map((portal) => (
          <Card key={portal.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{portal.name}</CardTitle>
                  <CardDescription className="mt-1">{portal.description ?? 'No description yet'}</CardDescription>
                </div>
                <Badge variant={(portal.publishedAt || (!portal.draftMode && portal.isPublic)) ? 'default' : 'secondary'}>
                  {portal.publishedAt ? 'published' : (!portal.draftMode && portal.isPublic) ? 'legacy live' : 'draft'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm">
                  <div className="font-mono text-xs text-muted-foreground mb-2">
                    /{portal.slug}
                  </div>
                  <p className="text-xs text-muted-foreground">{portal.widgetCount ?? 0} widgets</p>
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  <Button size="sm" variant="outline" asChild>
                    <a href={portal.isPublic && portal.publishedAt ? `/v/${portal.shareToken}` : `/v/preview?previewPortalId=${encodeURIComponent(portal.id)}`}>
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={`/dashboard/portals/${portal.id}/edit`}>
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </a>
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deletePortal(portal.id)}>
                    <Trash2 className="h-3 w-3" />
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
