'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LayoutGrid, Plus, Settings, Trash2, GripVertical, Eye, EyeOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface Widget {
  id: string;
  name: string;
  type: string;
  size: 'small' | 'medium' | 'large';
  position: { x: number; y: number };
  visible: boolean;
  config: Record<string, unknown>;
}

export default function WidgetsManagement() {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'chart',
    size: 'medium' as 'small' | 'medium' | 'large'
  });

  const fetchWidgets = useCallback(async () => {
    try {
      const response = await fetch('/api/widgets');
      const data = await response.json();
      setWidgets(data);
    } catch (error) {
      console.error('Failed to fetch widgets:', error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const response = await fetch('/api/widgets');
        const data = await response.json();
        if (mounted) setWidgets(data);
      } catch (error) {
        console.error('Failed to fetch widgets:', error);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      type: 'chart',
      size: 'medium'
    });
  }, []);

  const createWidget = useCallback(async () => {
    try {
      await fetch('/api/widgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      fetchWidgets();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Failed to create widget:', error);
    }
  }, [formData, fetchWidgets, resetForm]);

  const toggleWidget = useCallback(async (id: string, visible: boolean) => {
    try {
      await fetch(`/api/widgets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible })
      });
      fetchWidgets();
    } catch (error) {
      console.error('Failed to toggle widget:', error);
    }
  }, [fetchWidgets]);

  const deleteWidget = useCallback(async (id: string) => {
    try {
      await fetch(`/api/widgets/${id}`, { method: 'DELETE' });
      fetchWidgets();
    } catch (error) {
      console.error('Failed to delete widget:', error);
    }
  }, [fetchWidgets]);


  const widgetTypes = [
    'chart',
    'table',
    'metric',
    'list',
    'calendar',
    'map',
    'timeline',
    'gauge',
    'progress',
    'text'
  ];

  const widgetSizes = ['small', 'medium', 'large'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <LayoutGrid className="h-8 w-8" />
            Widgets
          </h1>
          <p className="text-muted-foreground">Manage dashboard widgets</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Widget
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Widget</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Widget Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Sales Chart"
                />
              </div>
              <div>
                <Label>Widget Type</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {widgetTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Size</Label>
                <Select value={formData.size} onValueChange={(value: string) => setFormData({ ...formData, size: value as 'small' | 'medium' | 'large' })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {widgetSizes.map(size => (
                      <SelectItem key={size} value={size}>{size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={createWidget}>Create</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Widgets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{widgets.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Visible</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {widgets.filter(w => w.visible).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Hidden</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {widgets.filter(w => !w.visible).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Widget Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(widgets.map(w => w.type)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {widgets.map((widget) => (
          <Card key={widget.id} className={`${!widget.visible ? 'opacity-60' : ''}`}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                  <div>
                    <CardTitle className="text-base">{widget.name}</CardTitle>
                    <CardDescription className="mt-1">{widget.type}</CardDescription>
                  </div>
                </div>
                <Badge variant="outline">{widget.size}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="h-32 bg-secondary rounded flex items-center justify-center text-muted-foreground">
                  Widget Preview
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleWidget(widget.id, !widget.visible)}
                  >
                    {widget.visible ? (
                      <><EyeOff className="h-3 w-3 mr-1" />Hide</>
                    ) : (
                      <><Eye className="h-3 w-3 mr-1" />Show</>
                    )}
                  </Button>
                  <Button size="sm" variant="outline">
                    <Settings className="h-3 w-3 mr-1" />
                    Configure
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteWidget(widget.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {widgets.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <LayoutGrid className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No widgets created yet</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
