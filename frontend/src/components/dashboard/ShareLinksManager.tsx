'use client';

import { useState, useEffect } from 'react';
import {
  Link2,
  Plus,
  Trash2,
  Copy,
  RefreshCw,
  Eye,
  EyeOff,
  Lock,
  Globe,
  Clock,
  Download,
  MoreVertical,
} from 'lucide-react';
import {
  shareLinksApi,
  ShareLink,
  CreateShareLinkDto,
} from '@/src/lib/enterprise-api';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { Switch } from '@/src/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';

interface ShareLinksManagerProps {
  className?: string;
  resourceType?: 'portal' | 'widget' | 'report';
  resourceId?: string;
}

export function ShareLinksManager({
  className,
  resourceType,
  resourceId,
}: ShareLinksManagerProps) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = async () => {
    try {
      const data = await shareLinksApi.getAll();
      // Filter by resource if specified
      const filtered = resourceType && resourceId
        ? data.filter(
            (l) => l.resourceType === resourceType && l.resourceId === resourceId
          )
        : data;
      setLinks(filtered);
    } catch (error) {
      console.error('Failed to load share links:', error);
      toast.error('Failed to load share links');
    } finally {
      setLoading(false);
    }
  };

  const deleteLink = async (linkId: string) => {
    if (!confirm('Are you sure you want to delete this share link?')) return;

    try {
      await shareLinksApi.delete(linkId);
      setLinks(links.filter((l) => l.id !== linkId));
      toast.success('Share link deleted');
    } catch (error) {
      console.error('Failed to delete link:', error);
      toast.error('Failed to delete link');
    }
  };

  const regenerateLink = async (linkId: string) => {
    try {
      const updated = await shareLinksApi.regenerate(linkId);
      setLinks(links.map((l) => (l.id === linkId ? { ...l, ...updated } : l)));
      await copyToClipboard(updated.shareUrl);
      toast.success('Link regenerated and copied to clipboard');
    } catch (error) {
      console.error('Failed to regenerate link:', error);
      toast.error('Failed to regenerate link');
    }
  };

  const toggleLink = async (linkId: string, isActive: boolean) => {
    try {
      await shareLinksApi.update(linkId, { });
      setLinks(links.map((l) => (l.id === linkId ? { ...l, isActive } : l)));
      toast.success(`Link ${isActive ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to update link:', error);
      toast.error('Failed to update link');
    }
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-indigo-500" />
          <h3 className="text-lg font-semibold">Share Links</h3>
          {links.length > 0 && (
            <Badge variant="secondary">{links.length}</Badge>
          )}
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Create Link
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <ShareLinkForm
              resourceType={resourceType}
              resourceId={resourceId}
              onSuccess={(shareUrl) => {
                setIsDialogOpen(false);
                loadLinks();
                copyToClipboard(shareUrl);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      ) : links.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Link2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No share links created.</p>
          <p className="text-sm">Create a link to share your content securely.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {links.map((link) => (
            <ShareLinkCard
              key={link.id}
              link={link}
              onDelete={deleteLink}
              onRegenerate={regenerateLink}
              onToggle={toggleLink}
              onCopy={copyToClipboard}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

interface ShareLinkCardProps {
  link: ShareLink;
  onDelete: (id: string) => void;
  onRegenerate: (id: string) => void;
  onToggle: (id: string, isActive: boolean) => void;
  onCopy: (url: string) => void;
}

function ShareLinkCard({
  link,
  onDelete,
  onRegenerate,
  onToggle,
  onCopy,
}: ShareLinkCardProps) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = `${baseUrl}/share/${link.token}`;

  const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date();
  const isMaxViewsReached = link.maxViews && link.viewCount >= link.maxViews;

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-semibold">
              {link.name || `${link.resourceType} Link`}
            </h4>
            <Badge variant="outline" className="text-xs">
              {link.resourceType}
            </Badge>
            {link.isActive && !isExpired && !isMaxViewsReached ? (
              <Badge variant="default" className="bg-green-500">
                Active
              </Badge>
            ) : (
              <Badge variant="secondary">
                {isExpired
                  ? 'Expired'
                  : isMaxViewsReached
                  ? 'Max Views'
                  : 'Inactive'}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 mb-3">
            <code className="bg-gray-100 px-2 py-1 rounded text-xs flex-1 truncate">
              {shareUrl}
            </code>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onCopy(shareUrl)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              {link.passwordProtected ? (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Password Protected</span>
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4" />
                  <span>Public</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              <span>
                {link.viewCount}
                {link.maxViews ? ` / ${link.maxViews}` : ''} views
              </span>
            </div>

            {link.allowDownload && (
              <div className="flex items-center gap-1">
                <Download className="h-4 w-4" />
                <span>Downloads allowed</span>
              </div>
            )}

            {link.expiresAt && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>
                  {isExpired
                    ? 'Expired'
                    : `Expires ${new Date(link.expiresAt).toLocaleDateString()}`}
                </span>
              </div>
            )}
          </div>

          {link.lastAccessedAt && (
            <div className="text-xs text-gray-500 mt-2">
              Last accessed: {new Date(link.lastAccessedAt).toLocaleString()}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 ml-4">
          <Switch
            checked={link.isActive}
            onCheckedChange={(checked) => onToggle(link.id, checked)}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onCopy(shareUrl)}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRegenerate(link.id)}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(link.id)}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

interface ShareLinkFormProps {
  resourceType?: 'portal' | 'widget' | 'report';
  resourceId?: string;
  onSuccess: (shareUrl: string) => void;
}

function ShareLinkForm({ resourceType, resourceId, onSuccess }: ShareLinkFormProps) {
  const [formData, setFormData] = useState<CreateShareLinkDto>({
    resourceType: resourceType || 'portal',
    resourceId: resourceId || '',
    name: '',
    password: '',
    maxViews: undefined,
    allowDownload: true,
    permissions: ['view'],
  });
  const [hasExpiration, setHasExpiration] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [hasMaxViews, setHasMaxViews] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.resourceId) {
      toast.error('Please enter a resource ID');
      return;
    }

    setSubmitting(true);
    try {
      const data: CreateShareLinkDto = {
        ...formData,
        password: hasPassword ? formData.password : undefined,
        maxViews: hasMaxViews ? formData.maxViews : undefined,
        expiresAt: hasExpiration ? formData.expiresAt : undefined,
      };

      const result = await shareLinksApi.create(data);
      toast.success('Share link created');
      onSuccess(result.shareUrl);
    } catch (error) {
      console.error('Failed to create share link:', error);
      toast.error('Failed to create share link');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Create Share Link</DialogTitle>
        <DialogDescription>
          Generate a secure link to share your content
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Link Name (optional)</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Marketing Dashboard Link"
          />
        </div>

        {!resourceType && (
          <div>
            <Label htmlFor="resourceType">Resource Type *</Label>
            <Select
              value={formData.resourceType}
              onValueChange={(value: 'portal' | 'widget' | 'report') =>
                setFormData({ ...formData, resourceType: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="portal">Portal</SelectItem>
                <SelectItem value="widget">Widget</SelectItem>
                <SelectItem value="report">Report</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {!resourceId && (
          <div>
            <Label htmlFor="resourceId">Resource ID *</Label>
            <Input
              id="resourceId"
              value={formData.resourceId}
              onChange={(e) =>
                setFormData({ ...formData, resourceId: e.target.value })
              }
              placeholder="portal-123"
              required
            />
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Password Protection
            </Label>
            <Switch checked={hasPassword} onCheckedChange={setHasPassword} />
          </div>
          {hasPassword && (
            <Input
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              placeholder="Enter password"
            />
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Expiration Date
            </Label>
            <Switch checked={hasExpiration} onCheckedChange={setHasExpiration} />
          </div>
          {hasExpiration && (
            <Input
              type="datetime-local"
              value={formData.expiresAt?.slice(0, 16) || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  expiresAt: new Date(e.target.value).toISOString(),
                })
              }
            />
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Max Views Limit
            </Label>
            <Switch checked={hasMaxViews} onCheckedChange={setHasMaxViews} />
          </div>
          {hasMaxViews && (
            <Input
              type="number"
              min={1}
              value={formData.maxViews || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  maxViews: parseInt(e.target.value) || undefined,
                })
              }
              placeholder="100"
            />
          )}
        </div>

        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Allow Downloads
          </Label>
          <Switch
            checked={formData.allowDownload}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, allowDownload: checked })
            }
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={() => onSuccess('')}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create Link'}
        </Button>
      </div>
    </form>
  );
}
