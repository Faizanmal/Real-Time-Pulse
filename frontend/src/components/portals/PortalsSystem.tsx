'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Layout, Plus, Eye, Edit, Trash2, Users } from 'lucide-react';

interface Portal {
  id: string;
  name: string;
  slug: string;
  description: string;
  theme: string;
  status: 'active' | 'draft';
  widgets: string[];
  users: number;
  views: number;
  createdAt: string;
}

export default function PortalsSystem() {
  const [portals, setPortals] = useState<Portal[]>([]);
  const [_loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await fetch('/api/portals');
        const data = await response.json();
        if (mounted) setPortals(data);
      } catch (error) {
        console.error('Failed to fetch portals:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const fetchPortals = async () => {
    try {
      const response = await fetch('/api/portals');
      const data = await response.json();
      setPortals(data);
    } catch (error) {
      console.error('Failed to fetch portals:', error);
    } finally {
      setLoading(false);
    }
  };

  const createPortal = async () => {
    window.location.href = '/portals/create';
  };

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
              {portals.filter(p => p.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {portals.reduce((acc, p) => acc + p.users, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {portals.map((portal) => (
          <Card key={portal.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{portal.name}</CardTitle>
                  <CardDescription className="mt-1">{portal.description}</CardDescription>
                </div>
                <Badge variant={portal.status === 'active' ? 'default' : 'secondary'}>
                  {portal.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm">
                  <div className="font-mono text-xs text-muted-foreground mb-2">
                    /{portal.slug}
                  </div>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span>{portal.users} users</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Eye className="h-3 w-3 text-muted-foreground" />
                      <span>{portal.views} views</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  <Button size="sm" variant="outline" asChild>
                    <a href={`/portals/${portal.slug}`}>
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={`/portals/${portal.id}/edit`}>
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
