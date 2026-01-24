'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus, Copy, Trash2, Star } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Template {
  id: string;
  name: string;
  type: string;
  description: string;
  category: string;
  content: Record<string, unknown>;
  isDefault: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function TemplatesManagement() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [formData, setFormData] = useState({
    name: '',
    type: 'dashboard',
    description: '',
    category: 'business',
    content: {}
  });

  const router = useRouter();

  const fetchTemplates = useCallback(async () => {
    try {
      const url = selectedCategory === 'all'
        ? '/api/templates'
        : `/api/templates?category=${selectedCategory}`;
      const response = await fetch(url);
      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  }, [selectedCategory]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const url = selectedCategory === 'all'
          ? '/api/templates'
          : `/api/templates?category=${selectedCategory}`;
        const response = await fetch(url);
        const data = await response.json();
        if (mounted) setTemplates(data);
      } catch (error) {
        console.error('Failed to fetch templates:', error);
      }
    };
    load();
    return () => { mounted = false; };
  }, [selectedCategory]);

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      type: 'dashboard',
      description: '',
      category: 'business',
      content: {}
    });
  }, []);

  const createTemplate = useCallback(async () => {
    try {
      await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      fetchTemplates();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Failed to create template:', error);
    }
  }, [formData, fetchTemplates, resetForm]);

  const duplicateTemplate = useCallback(async (id: string) => {
    try {
      await fetch(`/api/templates/${id}/duplicate`, { method: 'POST' });
      fetchTemplates();
    } catch (error) {
      console.error('Failed to duplicate template:', error);
    }
  }, [fetchTemplates]);

  const deleteTemplate = useCallback(async (id: string) => {
    try {
      await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      fetchTemplates();
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  }, [fetchTemplates]);

  const applyTemplate = useCallback((id: string) => {
    router.push(`/dashboard/new?template=${id}`);
  }, [router]);


  const categories = ['all', 'business', 'finance', 'marketing', 'operations', 'analytics'];
  const templateTypes = ['dashboard', 'report', 'chart', 'widget', 'workflow'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8" />
            Templates
          </h1>
          <p className="text-muted-foreground">Manage reusable templates</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Template Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Sales Dashboard Template"
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {templateTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c !== 'all').map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Template description..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={createTemplate}>Create</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        {categories.map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <Card key={template.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {template.isDefault && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                    {template.name}
                  </CardTitle>
                  <CardDescription className="mt-1">{template.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Badge variant="outline">{template.type}</Badge>
                  <Badge variant="secondary">{template.category}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Used {template.usageCount} times
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  <Button size="sm" variant="outline" onClick={() => applyTemplate(template.id)}>
                    Apply
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => duplicateTemplate(template.id)}>
                    <Copy className="h-3 w-3 mr-1" />
                    Duplicate
                  </Button>
                  {!template.isDefault && (
                    <Button size="sm" variant="destructive" onClick={() => deleteTemplate(template.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {templates.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No templates found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
