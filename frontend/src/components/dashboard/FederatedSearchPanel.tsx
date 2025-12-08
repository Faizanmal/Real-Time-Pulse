'use client';

import React, { useState, useCallback } from 'react';
import { useFederatedSearch } from '@/hooks/useAdvancedFeatures';
import type { SearchResult, SearchSource } from '@/hooks/useAdvancedFeatures.types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  Filter,
  Globe,
  Database,
  FileText,
  Layers,
  Zap,
  Clock,
  ExternalLink,
  Star,

  X,
} from 'lucide-react';

// Using shared SearchResult and SearchSource types from hooks types

export function FederatedSearchPanel() {
  const { results, loading, sources, search, semanticSearch } = useFederatedSearch();
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'standard' | 'semantic'>('standard');
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    // Load recent searches from localStorage only once
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to parse recent searches', e);
        return [];
      }
    }
    return [];
  });


  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    // Save to recent searches
    const updated = [query, ...recentSearches.filter((s) => s !== query)].slice(0, 10);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));

    const options = {
      sources: selectedSources.length > 0 ? selectedSources : undefined,
      limit: 20,
    };

    if (searchMode === 'semantic') {
      await semanticSearch(query, options);
    } else {
      await search(query, options);
    }
  }, [query, searchMode, selectedSources, search, semanticSearch, recentSearches]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const toggleSource = (sourceId: string) => {
    setSelectedSources((prev) =>
      prev.includes(sourceId)
        ? prev.filter((s) => s !== sourceId)
        : [...prev, sourceId]
    );
  };

  const getTypeIcon = (type?: string) => {
    const t = (type || '').toLowerCase();
    switch (t) {
      case 'portal':
        return <Layers className="h-4 w-4" />;
      case 'widget':
        return <Database className="h-4 w-4" />;
      case 'document':
        return <FileText className="h-4 w-4" />;
      case 'integration':
        return <Globe className="h-4 w-4" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 bg-green-100';
    if (score >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-600 bg-gray-100';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Search className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Federated Search</h2>
          <p className="text-sm text-gray-600">Search across all connected data sources</p>
        </div>
      </div>

      {/* Search Box */}
      <Card className="p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Search across all sources..."
              className="pl-10 pr-4 py-6 text-lg"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2"
              >
                <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? 'bg-gray-100' : ''}
          >
            <Filter className="h-5 w-5" />
          </Button>
          <Button onClick={handleSearch} disabled={loading || !query.trim()} className="px-8">
            {loading ? 'Searching...' : 'Search'}
          </Button>
        </div>

        {/* Search Mode Toggle */}
        <div className="flex items-center gap-4 mt-4">
          <span className="text-sm text-gray-600">Mode:</span>
          <div className="flex rounded-lg border overflow-hidden">
            <button
              className={`px-4 py-1.5 text-sm ${
                searchMode === 'standard'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setSearchMode('standard')}
            >
              Standard
            </button>
            <button
              className={`px-4 py-1.5 text-sm flex items-center gap-1 ${
                searchMode === 'semantic'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setSearchMode('semantic')}
            >
              <Zap className="h-3 w-3" />
              Semantic (AI)
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="font-medium mb-3">Data Sources</h4>
            <div className="flex flex-wrap gap-2">
              {sources.length > 0 ? (
                sources.map((source: SearchSource) => (
                  <button
                    key={source.id}
                    onClick={() => toggleSource(source.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      selectedSources.includes(source.id)
                        ? 'bg-blue-100 border-blue-300 text-blue-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {source.name}
                  </button>
                ))
              ) : (
                <span className="text-sm text-gray-500">All sources enabled</span>
              )}
            </div>
          </div>
        )}

        {/* Recent Searches */}
        {recentSearches.length > 0 && !query && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm text-gray-500 mb-2 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Recent Searches
            </h4>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((recentQuery, idx) => (
                <button
                  key={idx}
                  onClick={() => setQuery(recentQuery)}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-full"
                >
                  {recentQuery}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Found {results.length} results
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Sort by:</span>
              <select className="text-sm border rounded-lg px-2 py-1">
                <option value="relevance">Relevance</option>
                <option value="date">Date</option>
                <option value="type">Type</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {results.map((result: SearchResult) => (
              <Card key={result.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    {getTypeIcon(result.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {result.type}
                      </Badge>
                      {result.source && (
                        <Badge variant="outline" className="text-xs bg-blue-50">
                          {result.source}
                        </Badge>
                      )}
                      <Badge className={`text-xs ${getScoreColor(result.score ?? 0)}`}>
                        <Star className="h-3 w-3 mr-1" />
                        {typeof result.score === 'number' ? `${Math.round(result.score * 100)}%` : '—'}
                      </Badge>
                    </div>
                    <h3 className="font-medium text-lg">{result.title}</h3>
                    {result.description && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {result.description}
                      </p>
                    )}
                    {result.highlights && result.highlights.length > 0 && (
                      <div className="mt-2 text-sm">
                        {result.highlights.map((highlight, idx) => (
                          <p
                            key={idx}
                            className="text-gray-600"
                            dangerouslySetInnerHTML={{ __html: `...${highlight}...` }}
                          />
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-4 mt-3">
                      {result.url && (
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                        >
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      <span className="text-xs text-gray-400">
                        ID: {result.id.slice(0, 8)}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && results.length === 0 && query && (
        <Card className="p-12 text-center">
          <Search className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-600">No results found</h3>
          <p className="text-sm text-gray-500 mt-1">
            Try different keywords or enable more data sources
          </p>
        </Card>
      )}

      {/* Initial State */}
      {!loading && results.length === 0 && !query && (
        <Card className="p-12 text-center">
          <Globe className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-600">Search Everything</h3>
          <p className="text-sm text-gray-500 mt-1">
            Enter a query to search across all your connected data sources
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <div className="text-center">
              <div className="p-2 bg-gray-100 rounded-lg inline-block mb-2">
                <Database className="h-5 w-5 text-gray-600" />
              </div>
              <p className="text-xs text-gray-500">Databases</p>
            </div>
            <div className="text-center">
              <div className="p-2 bg-gray-100 rounded-lg inline-block mb-2">
                <FileText className="h-5 w-5 text-gray-600" />
              </div>
              <p className="text-xs text-gray-500">Documents</p>
            </div>
            <div className="text-center">
              <div className="p-2 bg-gray-100 rounded-lg inline-block mb-2">
                <Layers className="h-5 w-5 text-gray-600" />
              </div>
              <p className="text-xs text-gray-500">Portals</p>
            </div>
            <div className="text-center">
              <div className="p-2 bg-gray-100 rounded-lg inline-block mb-2">
                <Globe className="h-5 w-5 text-gray-600" />
              </div>
              <p className="text-xs text-gray-500">APIs</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
