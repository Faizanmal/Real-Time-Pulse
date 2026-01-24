'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { FolderOpen, Plus, Users, Settings, Trash2, Lock, Globe, Star } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// import { Switch } from '@/components/ui/switch';

interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface WorkspaceData {
  id: string;
  name: string;
  description: string;
  type: 'personal' | 'team' | 'enterprise';
  visibility: 'private' | 'public';
  members: WorkspaceMember[];
  dashboards: number;
  reports: number;
  isDefault: boolean;
  createdAt: string;
  owner: string;
}

export default function WorkspacesManagement() {
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceData | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'team' as 'personal' | 'team' | 'enterprise',
    visibility: 'private' as 'private' | 'public'
  });

  const fetchWorkspaces = useCallback(async () => {
    try {
      const response = await fetch('/api/workspaces');
      const data = await response.json();
      setWorkspaces(data);
    } catch (error) {
      console.error('Failed to fetch workspaces:', error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const response = await fetch('/api/workspaces');
        const data = await response.json();
        if (mounted) setWorkspaces(data);
      } catch (error) {
        console.error('Failed to fetch workspaces:', error);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      description: '',
      type: 'team',
      visibility: 'private'
    });
  }, []);

  const createWorkspace = useCallback(async () => {
    try {
      await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      fetchWorkspaces();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Failed to create workspace:', error);
    }
  }, [formData, fetchWorkspaces, resetForm]);

  const setDefaultWorkspace = useCallback(async (id: string) => {
    try {
      await fetch(`/api/workspaces/${id}/default`, { method: 'POST' });
      fetchWorkspaces();
    } catch (error) {
      console.error('Failed to set default workspace:', error);
    }
  }, [fetchWorkspaces]);

  const deleteWorkspace = useCallback(async (id: string) => {
    try {
      await fetch(`/api/workspaces/${id}`, { method: 'DELETE' });
      fetchWorkspaces();
      if (selectedWorkspace?.id === id) {
        setSelectedWorkspace(null);
      }
    } catch (error) {
      console.error('Failed to delete workspace:', error);
    }
  }, [fetchWorkspaces, selectedWorkspace]);

  const switchWorkspace = (workspace: WorkspaceData) => {
    localStorage.setItem('activeWorkspace', workspace.id);
    window.location.reload();
  };


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FolderOpen className="h-8 w-8" />
            Workspaces
          </h1>
          <p className="text-muted-foreground">Organize and manage your workspaces</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Create Workspace
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Workspace</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Workspace Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Marketing Team"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Workspace for marketing team dashboards and reports"
                  rows={3}
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={(value: string) => setFormData({ ...formData, type: value as 'personal' | 'team' | 'enterprise' })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="team">Team</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Visibility</Label>
                <Select value={formData.visibility} onValueChange={(value: string) => setFormData({ ...formData, visibility: value as 'private' | 'public' })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={createWorkspace}>Create</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Workspaces</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workspaces.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Team Workspaces</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {workspaces.filter(w => w.type === 'team').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {workspaces.reduce((acc, w) => acc + w.members.length, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Dashboards</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {workspaces.reduce((acc, w) => acc + w.dashboards, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workspaces.map((workspace) => (
          <Card key={workspace.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {workspace.isDefault && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                    <FolderOpen className="h-4 w-4" />
                    {workspace.name}
                  </CardTitle>
                  <CardDescription className="mt-1">{workspace.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Badge variant="outline">{workspace.type}</Badge>
                  <Badge variant="secondary" className="gap-1">
                    {workspace.visibility === 'private' ? (
                      <><Lock className="h-3 w-3" />Private</>
                    ) : (
                      <><Globe className="h-3 w-3" />Public</>
                    )}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Members</div>
                    <div className="font-semibold flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {workspace.members.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Dashboards</div>
                    <div className="font-semibold">{workspace.dashboards}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Reports</div>
                    <div className="font-semibold">{workspace.reports}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Owner</div>
                    <div className="font-semibold text-xs">{workspace.owner}</div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t">
                  <Button 
                    size="sm" 
                    variant="default" 
                    className="w-full"
                    onClick={() => switchWorkspace(workspace)}
                  >
                    Switch to Workspace
                  </Button>
                  <div className="flex gap-2">
                    {!workspace.isDefault && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setDefaultWorkspace(workspace.id)}
                      >
                        <Star className="h-3 w-3 mr-1" />
                        Set Default
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedWorkspace(workspace)}
                    >
                      <Settings className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteWorkspace(workspace.id)}
                      disabled={workspace.isDefault}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {workspaces.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No workspaces created yet</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
