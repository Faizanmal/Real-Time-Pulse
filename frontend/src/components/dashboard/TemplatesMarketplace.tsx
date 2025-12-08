'use client';

import { useState, useEffect } from 'react';
import {
  LayoutTemplate,
  Star,
  Download,
  Search,
  Plus,
  Eye,
  Tag,
  User,
  MoreVertical,
  Trash2,
  Globe,
  Lock,
} from 'lucide-react';
import {
  templatesApi,
  Template,
  CreateTemplateDto,
} from '@/lib/enterprise-api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface TemplatesMarketplaceProps {
  className?: string;
  onUseTemplate?: (templateId: string, resourceId: string) => void;
}

export function TemplatesMarketplace({
  className,
  onUseTemplate,
}: TemplatesMarketplaceProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [myTemplates, setMyTemplates] = useState<Template[]>([]);
  const [featuredTemplates, setFeaturedTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [activeTab, setActiveTab] = useState('browse');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [allTemplates, featured, cats, mine] = await Promise.all([
        templatesApi.getAll(),
        templatesApi.getFeatured(),
        templatesApi.getCategories(),
        templatesApi.getMyTemplates(),
      ]);
      setTemplates(allTemplates);
      setFeaturedTemplates(featured);
      setCategories(cats);
      setMyTemplates(mine);
    } catch (error) {
      console.error('Failed to load templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      !searchQuery ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some((tag) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      );
    const matchesType =
      selectedType === 'all' || template.type === selectedType;
    const matchesCategory =
      selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesType && matchesCategory;
  });

  const handleUseTemplate = async (template: Template) => {
    const targetId = prompt('Enter the target resource ID (portal or widget ID):');
    if (!targetId) return;

    try {
      const result = await templatesApi.use(template.id, targetId);
      toast.success(result.message);
      if (onUseTemplate) {
        onUseTemplate(template.id, result.resourceId);
      }
    } catch (error) {
      console.error('Failed to use template:', error);
      toast.error('Failed to apply template');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await templatesApi.delete(templateId);
      setMyTemplates(myTemplates.filter((t) => t.id !== templateId));
      setTemplates(templates.filter((t) => t.id !== templateId));
      toast.success('Template deleted');
    } catch (error) {
      console.error('Failed to delete template:', error);
      toast.error('Failed to delete template');
    }
  };

  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <LayoutTemplate className="h-5 w-5 text-purple-500" />
          <h3 className="text-lg font-semibold">Templates Marketplace</h3>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <TemplateForm
              onSuccess={() => {
                setIsDialogOpen(false);
                loadData();
              }}
              categories={categories}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="browse">Browse</TabsTrigger>
          <TabsTrigger value="featured">Featured</TabsTrigger>
          <TabsTrigger value="my-templates">My Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="browse">
          {/* Search and Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="widget">Widgets</SelectItem>
                <SelectItem value="portal">Portals</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-64 bg-gray-200 rounded animate-pulse" />
              ))}
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <LayoutTemplate className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No templates found.</p>
              <p className="text-sm">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onView={setSelectedTemplate}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="featured">
          {featuredTemplates.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Star className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No featured templates yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onView={setSelectedTemplate}
                  featured
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="my-templates">
          {myTemplates.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>You haven&apos;t created any templates yet.</p>
              <Button
                className="mt-4"
                onClick={() => setIsDialogOpen(true)}
              >
                Create Your First Template
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onView={setSelectedTemplate}
                  onDelete={handleDeleteTemplate}
                  isOwner
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Template Preview Dialog */}
      {selectedTemplate && (
        <Dialog
          open={!!selectedTemplate}
          onOpenChange={() => setSelectedTemplate(null)}
        >
          <DialogContent className="max-w-2xl">
            <TemplatePreview
              template={selectedTemplate}
              onUse={handleUseTemplate}
              onClose={() => setSelectedTemplate(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

interface TemplateCardProps {
  template: Template;
  onView: (template: Template) => void;
  onDelete?: (templateId: string) => void;
  featured?: boolean;
  isOwner?: boolean;
}

function TemplateCard({
  template,
  onView,
  onDelete,
  featured,
  isOwner,
}: TemplateCardProps) {
  return (
    <div
      className={cn(
        'border rounded-lg overflow-hidden transition-shadow hover:shadow-lg cursor-pointer',
        featured && 'ring-2 ring-yellow-400'
      )}
      onClick={() => onView(template)}
    >
      {/* Thumbnail */}
      <div className="h-32 bg-gradient-to-br from-gray-100 to-gray-200 relative">
        {template.thumbnail ? (
          <Image
            src={template.thumbnail}
            alt={template.name}
            width={400}
            height={200}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <LayoutTemplate className="h-12 w-12 text-gray-400" />
          </div>
        )}
        {featured && (
          <Badge className="absolute top-2 left-2 bg-yellow-500">
            <Star className="h-3 w-3 mr-1" />
            Featured
          </Badge>
        )}
        <Badge
          variant="outline"
          className="absolute top-2 right-2 bg-white/90"
        >
          {template.type}
        </Badge>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h4 className="font-semibold">{template.name}</h4>
            <p className="text-xs text-gray-500">{template.category}</p>
          </div>
          {(isOwner || onDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger
                asChild
                onClick={(e) => e.stopPropagation()}
              >
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onView(template);
                  }}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View
                </DropdownMenuItem>
                {isOwner && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.(template.id);
                    }}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {template.description && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">
            {template.description}
          </p>
        )}

        {/* Tags */}
        {template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {template.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {template.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{template.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
              {template.rating.toFixed(1)}
              <span className="text-xs">({template.ratingCount})</span>
            </span>
            <span className="flex items-center gap-1">
              <Download className="h-4 w-4" />
              {template.usageCount}
            </span>
          </div>
          <span className="flex items-center gap-1">
            {template.isPublic ? (
              <Globe className="h-4 w-4" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

interface TemplatePreviewProps {
  template: Template;
  onUse: (template: Template) => void;
  onClose: () => void;
}

function TemplatePreview({ template, onUse, onClose }: TemplatePreviewProps) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  const handleRate = async () => {
    if (rating === 0) return;

    setSubmittingRating(true);
    try {
      await templatesApi.rate(template.id, { rating, review });
      toast.success('Thanks for your rating!');
    } catch (error) {
      console.error('Failed to rate template:', error);
      toast.error('Failed to submit rating');
    } finally {
      setSubmittingRating(false);
    }
  };

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {template.name}
          {template.isFeatured && (
            <Badge className="bg-yellow-500">
              <Star className="h-3 w-3 mr-1" />
              Featured
            </Badge>
          )}
        </DialogTitle>
        <DialogDescription>{template.description}</DialogDescription>
      </DialogHeader>

      {/* Preview Image */}
      <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg overflow-hidden">
        {template.thumbnail ? (
          <Image
            src={template.thumbnail}
            alt={template.name}
            width={400}
            height={200}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <LayoutTemplate className="h-16 w-16 text-gray-400" />
          </div>
        )}
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-gray-500">Type</Label>
          <p className="capitalize">{template.type}</p>
        </div>
        <div>
          <Label className="text-gray-500">Category</Label>
          <p>{template.category}</p>
        </div>
        <div>
          <Label className="text-gray-500">Usage</Label>
          <p>{template.usageCount} times</p>
        </div>
        <div>
          <Label className="text-gray-500">Rating</Label>
          <p className="flex items-center gap-1">
            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            {template.rating.toFixed(1)} ({template.ratingCount} reviews)
          </p>
        </div>
      </div>

      {/* Tags */}
      {template.tags.length > 0 && (
        <div>
          <Label className="text-gray-500">Tags</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {template.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                <Tag className="h-3 w-3 mr-1" />
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Author */}
      {template.author && (
        <div>
          <Label className="text-gray-500">Created by</Label>
          <p className="flex items-center gap-2 mt-1">
            <User className="h-4 w-4" />
            {template.author.firstName && template.author.lastName
              ? `${template.author.firstName} ${template.author.lastName}`
              : 'Unknown'}
          </p>
        </div>
      )}

      {/* Rate this template */}
      <div className="border-t pt-4">
        <Label>Rate this template</Label>
        <div className="flex items-center gap-2 mt-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className="focus:outline-none"
            >
              <Star
                className={cn(
                  'h-6 w-6 transition-colors',
                  star <= rating
                    ? 'text-yellow-500 fill-yellow-500'
                    : 'text-gray-300'
                )}
              />
            </button>
          ))}
          <span className="ml-2 text-sm text-gray-500">
            {rating > 0 ? `${rating} star${rating > 1 ? 's' : ''}` : 'Select rating'}
          </span>
        </div>
        {rating > 0 && (
          <div className="mt-3 space-y-2">
            <Textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Write a review (optional)"
              className="h-20"
            />
            <Button
              size="sm"
              onClick={handleRate}
              disabled={submittingRating}
            >
              Submit Rating
            </Button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button onClick={() => onUse(template)} className="gap-2">
          <Download className="h-4 w-4" />
          Use Template
        </Button>
      </div>
    </div>
  );
}

interface TemplateFormProps {
  onSuccess: () => void;
  categories: string[];
}

function TemplateForm({ onSuccess, categories }: TemplateFormProps) {
  const [formData, setFormData] = useState<CreateTemplateDto>({
    name: '',
    description: '',
    type: 'widget',
    category: '',
    config: {},
    tags: [],
    isPublic: true,
  });
  const [tagInput, setTagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const addTag = () => {
    if (tagInput && !formData.tags?.includes(tagInput)) {
      setFormData({
        ...formData,
        tags: [...(formData.tags || []), tagInput],
      });
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags?.filter((t) => t !== tag),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.category) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      await templatesApi.create(formData);
      toast.success('Template created successfully');
      onSuccess();
    } catch (error) {
      console.error('Failed to create template:', error);
      toast.error('Failed to create template');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Create Template</DialogTitle>
        <DialogDescription>
          Share your widget or portal configuration as a reusable template
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Template Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Sales Dashboard Template"
            required
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="A comprehensive sales dashboard with KPIs, charts, and forecasts"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="type">Type *</Label>
            <Select
              value={formData.type}
              onValueChange={(value: 'widget' | 'portal') =>
                setFormData({ ...formData, type: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="widget">Widget</SelectItem>
                <SelectItem value="portal">Portal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="category">Category *</Label>
            <Select
              value={formData.category}
              onValueChange={(value) =>
                setFormData({ ...formData, category: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Tags</Label>
          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Add a tag"
              onKeyPress={(e) =>
                e.key === 'Enter' && (e.preventDefault(), addTag())
              }
            />
            <Button type="button" onClick={addTag} variant="outline">
              Add
            </Button>
          </div>
          {formData.tags && formData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-1 hover:text-red-600"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            {formData.isPublic ? (
              <Globe className="h-4 w-4" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            {formData.isPublic ? 'Public Template' : 'Private Template'}
          </Label>
          <Switch
            checked={formData.isPublic}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, isPublic: checked })
            }
          />
        </div>
        <p className="text-xs text-gray-500">
          {formData.isPublic
            ? 'Anyone can discover and use this template'
            : 'Only you can access this template'}
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create Template'}
        </Button>
      </div>
    </form>
  );
}
