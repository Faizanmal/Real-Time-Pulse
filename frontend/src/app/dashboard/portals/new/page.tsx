'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { portalsApi } from '@/lib/api/index';
import { portalApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function NewPortalPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    isPublic: false,
  });
  const [loading, setLoading] = useState(false);
  const [slugError, setSlugError] = useState('');
  const [sampleLoading, setSampleLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSlugError('');
    setFormError('');

    try {
      const portal = await portalsApi.createPortal(formData);
      router.push(`/dashboard/portals/${portal.id}/edit`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create portal';
      if (message.toLowerCase().includes('slug already exists')) {
        setSlugError('This slug is already taken. Please choose a different one.');
        toast.error('This portal slug already exists. Please use another slug.');
      } else {
        setFormError(message);
        toast.error(message);
      }
      console.error('Failed to create portal:', error);
    } finally {
      setLoading(false);
    }
  };

  const startWithSample = async () => {
    setSampleLoading(true);
    setFormError('');
    try {
      const demo = await portalApi.createDemoClientPortal();
      router.push(`/dashboard/portals/${demo.portalId}/edit`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Sample portal could not be created.');
    } finally {
      setSampleLoading(false);
    }
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Create New Portal</CardTitle>
          <CardDescription>
            Set up a new portal for your users. Configure the basic settings below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
            <p className="font-semibold">Build from fictional sample data</p>
            <p className="mt-1 text-sm">Creates a clearly labelled local demo portal with no provider credentials or live data.</p>
            <Button type="button" className="mt-3" variant="outline" disabled={sampleLoading} onClick={() => void startWithSample()}>
              {sampleLoading ? 'Preparing sample…' : 'Start with sample portal'}
            </Button>
          </div>
          {formError && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{formError}</p>}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Portal Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Enter portal name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => handleChange('slug', e.target.value)}
                  placeholder="portal-slug"
                  required
                />
                {slugError ? (
                  <p className="text-sm text-red-600">{slugError}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Describe your portal"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="isPublic">Visibility</Label>
              <Select value={formData.isPublic ? 'public' : 'private'} onValueChange={(value) => handleChange('isPublic', value === 'public')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Portal'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
