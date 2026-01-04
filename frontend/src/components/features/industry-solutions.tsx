'use client';

import { useState, useEffect } from 'react';
import { industryApi } from '@/lib/advanced-api';
import type { IndustryTemplate, IndustryType } from '@/types/advanced-features';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Download, Shield, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const INDUSTRY_COLORS: Record<IndustryType, string> = {
  HEALTHCARE: 'bg-blue-100 text-blue-800',
  FINANCE: 'bg-green-100 text-green-800',
  RETAIL: 'bg-purple-100 text-purple-800',
  MANUFACTURING: 'bg-orange-100 text-orange-800',
  EDUCATION: 'bg-yellow-100 text-yellow-800',
  REAL_ESTATE: 'bg-pink-100 text-pink-800',
  LOGISTICS: 'bg-indigo-100 text-indigo-800',
  HOSPITALITY: 'bg-red-100 text-red-800',
  TECHNOLOGY: 'bg-cyan-100 text-cyan-800',
  GOVERNMENT: 'bg-gray-100 text-gray-800',
};

interface Props {
  onSelectTemplate?: (template: IndustryTemplate) => void;
}

export default function IndustrySolutionsComponent({ onSelectTemplate }: Props) {
  const [templates, setTemplates] = useState<IndustryTemplate[]>([]);
  const [selectedIndustry, setSelectedIndustry] = useState<IndustryType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, [selectedIndustry]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await industryApi.getTemplates(selectedIndustry || undefined);
      const data = response.data;
      if (Array.isArray(data)) {
        setTemplates(data);
      } else if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as any).data)) {
        setTemplates((data as any).data);
      } else {
        console.warn('Unexpected API response format for templates:', data);
        setTemplates([]);
      }
    } catch (error: any) {
      toast.error('Failed to load templates', {
        description: error.response?.data?.message || error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async (template: IndustryTemplate) => {
    if (onSelectTemplate) {
      onSelectTemplate(template);
    } else {
      toast.info('Please select a portal to deploy this template');
    }
  };

  const handleRate = async (templateId: string, rating: number) => {
    try {
      await industryApi.rateTemplate(templateId, rating);
      toast.success('Thank you for your rating!');
      loadTemplates();
    } catch (error: any) {
      toast.error('Failed to rate template', {
        description: error.response?.data?.message || error.message,
      });
    }
  };

  const industries = Object.keys(INDUSTRY_COLORS) as IndustryType[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Industry Solutions</h2>
        <p className="text-muted-foreground">
          Pre-built, compliance-ready dashboards for your industry
        </p>
      </div>

      {/* Industry Filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedIndustry === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedIndustry(null)}
        >
          All Industries
        </Button>
        {industries.map((industry) => (
          <Button
            key={industry}
            variant={selectedIndustry === industry ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedIndustry(industry)}
          >
            {industry.replace(/_/g, ' ')}
          </Button>
        ))}
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-24 bg-gray-200 rounded mb-4"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No templates found for the selected industry
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </div>
                  <Badge className={INDUSTRY_COLORS[template.industry]} variant="secondary">
                    {template.industry.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Thumbnail */}
                {template.thumbnail && (
                  <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                    <img
                      src={template.thumbnail}
                      alt={template.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Stats */}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span>{template.rating.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Download className="h-4 w-4" />
                    <span>{template.usageCount} deployments</span>
                  </div>
                </div>

                {/* Features */}
                <div className="flex flex-wrap gap-2">
                  {template.config?.security && (
                    <Badge variant="outline" className="text-xs">
                      <Shield className="h-3 w-3 mr-1" />
                      Secure
                    </Badge>
                  )}
                  {template.config?.compliance && (
                    <Badge variant="outline" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Compliant
                    </Badge>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button onClick={() => handleDeploy(template)} className="flex-1">
                    Deploy Template
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleRate(template.id, 5)}
                  >
                    <Star className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
