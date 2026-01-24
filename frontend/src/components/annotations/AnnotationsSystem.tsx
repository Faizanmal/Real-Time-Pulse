'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Plus, Trash2, Tag, User, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface Annotation {
  id: string;
  entityType: string;
  entityId: string;
  content: string;
  tags: string[];
  author: string;
  createdAt: string;
  updatedAt: string;
}

export default function AnnotationsSystem() {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEntityType, setSelectedEntityType] = useState<string>('all');
  const [formData, setFormData] = useState({
    entityType: 'dashboard',
    entityId: '',
    content: '',
    tags: ''
  });

  const fetchAnnotations = useCallback(async () => {
    try {
      const url = selectedEntityType === 'all' 
        ? '/api/annotations'
        : `/api/annotations?entityType=${selectedEntityType}`;
      const response = await fetch(url);
      const data = await response.json();
      setAnnotations(data);
    } catch (error) {
      console.error('Failed to fetch annotations:', error);
    }
  }, [selectedEntityType]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const url = selectedEntityType === 'all' 
          ? '/api/annotations'
          : `/api/annotations?entityType=${selectedEntityType}`;
        const response = await fetch(url);
        const data = await response.json();
        if (mounted) setAnnotations(data);
      } catch (error) {
        console.error('Failed to fetch annotations:', error);
      }
    };
    load();
    return () => { mounted = false; };
  }, [selectedEntityType]);

  const createAnnotation = async () => {
    try {
      const tags = formData.tags.split(',').map(t => t.trim()).filter(t => t);
      await fetch('/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          tags
        })
      });
      fetchAnnotations();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Failed to create annotation:', error);
    }
  };

  const deleteAnnotation = async (id: string) => {
    try {
      await fetch(`/api/annotations/${id}`, { method: 'DELETE' });
      fetchAnnotations();
    } catch (error) {
      console.error('Failed to delete annotation:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      entityType: 'dashboard',
      entityId: '',
      content: '',
      tags: ''
    });
  };

  const entityTypes = ['all', 'dashboard', 'chart', 'report', 'dataset', 'query'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="h-8 w-8" />
            Annotations
          </h1>
          <p className="text-muted-foreground">Add contextual notes and comments to your data</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              New Annotation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Annotation</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Entity Type</Label>
                <select
                  className="w-full p-2 border rounded"
                  value={formData.entityType}
                  onChange={(e) => setFormData({ ...formData, entityType: e.target.value })}
                >
                  {entityTypes.filter(t => t !== 'all').map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Entity ID</Label>
                <Input
                  value={formData.entityId}
                  onChange={(e) => setFormData({ ...formData, entityId: e.target.value })}
                  placeholder="e.g., dashboard-123"
                />
              </div>
              <div>
                <Label>Content</Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Add your annotation here..."
                  rows={4}
                />
              </div>
              <div>
                <Label>Tags (comma-separated)</Label>
                <Input
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="important, review, bug"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={createAnnotation}>Create</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        {entityTypes.map((type) => (
          <Button
            key={type}
            variant={selectedEntityType === type ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedEntityType(type)}
          >
            {type}
          </Button>
        ))}
      </div>

      <div className="space-y-4">
        {annotations.map((annotation) => (
          <Card key={annotation.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    {annotation.entityType} - {annotation.entityId}
                  </CardTitle>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteAnnotation(annotation.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm">{annotation.content}</p>
                {annotation.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {annotation.tags.map((tag, idx) => (
                      <Badge key={idx} variant="secondary" className="gap-1">
                        <Tag className="h-3 w-3" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {annotation.author}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(annotation.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {annotations.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No annotations found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
