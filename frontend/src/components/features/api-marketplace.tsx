'use client';

import { useState, useEffect } from 'react';
import { apiMarketplaceApi } from '@/lib/advanced-api';
import type { APIConnector } from '@/types/advanced-features';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Star, Download, Search, Plug, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function APIMarketplace() {
  const [connectors, setConnectors] = useState<APIConnector[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConnectors();
  }, []);

  const loadConnectors = async () => {
    try {
      const response = await apiMarketplaceApi.getConnectors();
      // Handle potential different response structures
      const data = response.data;
      if (Array.isArray(data)) {
        setConnectors(data);
      } else if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as any).data)) {
        // Handle paginated response { data: [], total: ... }
        setConnectors((data as any).data);
      } else {
        console.warn('Unexpected API response format for connectors:', data);
        setConnectors([]);
      }
    } catch (error: any) {
      console.error('Failed to load connectors:', error);
      toast.error('Failed to load connectors');
      setConnectors([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (connector: APIConnector) => {
    try {
      await apiMarketplaceApi.installConnector(connector.id, {}, {});
      toast.success(`${connector.name} installed successfully`);
      loadConnectors();
    } catch (error: any) {
      toast.error('Failed to install connector');
    }
  };

  const filteredConnectors = connectors.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories = Array.from(new Set(connectors.map((c) => c.category)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">API Marketplace</h2>
        <p className="text-muted-foreground">
          Connect to hundreds of data sources and services
        </p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search connectors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Connectors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{connectors.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Downloads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {connectors.reduce((sum, c) => sum + c.downloads, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Rating
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(connectors.reduce((sum, c) => sum + c.rating, 0) / connectors.length || 0).toFixed(
                1
              )}
              <Star className="inline h-5 w-5 ml-1 fill-yellow-400 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connectors Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-24 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredConnectors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Plug className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No connectors found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredConnectors.map((connector) => (
            <Card key={connector.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {connector.iconUrl && (
                      <img
                        src={connector.iconUrl}
                        alt={connector.name}
                        className="w-10 h-10 rounded"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{connector.name}</CardTitle>
                        {connector.isVerified && (
                          <CheckCircle className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <CardDescription>{connector.description}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Category and Type */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{connector.category}</Badge>
                  <Badge variant="outline">{connector.connectorType}</Badge>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span>{connector.rating.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Download className="h-4 w-4" />
                    <span>{connector.downloads.toLocaleString()}</span>
                  </div>
                  {connector.price > 0 && (
                    <span className="font-medium">${connector.price}/mo</span>
                  )}
                  {connector.price === 0 && (
                    <span className="text-green-600 font-medium">Free</span>
                  )}
                </div>

                {/* Actions */}
                <Button onClick={() => handleInstall(connector)} className="w-full">
                  <Plug className="h-4 w-4 mr-2" />
                  Install
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
