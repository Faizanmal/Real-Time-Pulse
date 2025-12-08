 'use client';

import React, { useState, useEffect } from 'react';
import { useAPIMarketplace } from '@/hooks/useAdvancedFeatures';
import type { APIConnector } from '@/hooks/useAdvancedFeatures.types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, ExternalLink, Cloud } from 'lucide-react';

export function APIMarketplacePanel() {
  const {
    connectors,
    fetchConnectors,
    fetchInstalled,
    fetchEndpoints,
    installConnector,
  } = useAPIMarketplace();

  const [query, setQuery] = useState('');

  useEffect(() => {
    fetchConnectors();
    fetchInstalled();
    fetchEndpoints();
  }, [fetchConnectors, fetchInstalled, fetchEndpoints]);

  const filtered = connectors.filter((c: APIConnector) =>
    !query || c.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Cloud className="h-6 w-6 text-green-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">API Marketplace</h2>
            <p className="text-sm text-gray-600">Discover and install external connectors and build custom endpoints</p>
          </div>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Publish Connector
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex gap-2">
          <Input placeholder="Search connectors..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((c: APIConnector) => (
          <Card key={c.id} className="p-4 hover:shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-sm text-gray-500">{c.description}</div>
              </div>
              <div className="flex items-center gap-2">
                <a href={(c as APIConnector & { documentationUrl?: string }).documentationUrl || '#'} target="_blank" rel="noreferrer" className="text-sm text-blue-600 flex items-center gap-1">
                  Docs <ExternalLink className="h-4 w-4" />
                </a>
                <Button size="sm" onClick={() => installConnector(c.id, {})}>Install</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
