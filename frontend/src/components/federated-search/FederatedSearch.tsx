'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search as SearchIcon, Filter, Clock, FileText, Database, TrendingUp } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SearchResult {
  id: string;
  source: string;
  type: string;
  title: string;
  description: string;
  score: number;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export default function FederatedSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    try {
      const response = await fetch('/api/federated-search/sources');
      const data = await response.json();
      setSources(data);
      setSelectedSources(data);
    } catch (error) {
      console.error('Failed to fetch sources:', error);
    }
  };

  const search = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/federated-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          sources: selectedSources
        })
      });
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Failed to search:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSource = (source: string) => {
    setSelectedSources(prev =>
      prev.includes(source)
        ? prev.filter(s => s !== source)
        : [...prev, source]
    );
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'dashboards': return <TrendingUp className="h-4 w-4" />;
      case 'reports': return <FileText className="h-4 w-4" />;
      case 'datasets': return <Database className="h-4 w-4" />;
      default: return <SearchIcon className="h-4 w-4" />;
    }
  };

  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.source]) {
      acc[result.source] = [];
    }
    acc[result.source].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <SearchIcon className="h-8 w-8" />
          Federated Search
        </h1>
        <p className="text-muted-foreground">Search across all data sources</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && search()}
                placeholder="Search across all sources..."
                className="flex-1"
              />
              <Button onClick={search} disabled={loading}>
                <SearchIcon className="h-4 w-4 mr-2" />
                {loading ? 'Searching...' : 'Search'}
              </Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground flex items-center">
                <Filter className="h-3 w-3 mr-2" />
                Sources:
              </span>
              {sources.map((source) => (
                <Badge
                  key={source}
                  variant={selectedSources.includes(source) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleSource(source)}
                >
                  {getSourceIcon(source)}
                  <span className="ml-1">{source}</span>
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{results.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Sources Searched</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Object.keys(groupedResults).length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Avg Relevance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(results.reduce((acc, r) => acc + r.score, 0) / results.length).toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Results ({results.length})</TabsTrigger>
          {Object.keys(groupedResults).map((source) => (
            <TabsTrigger key={source} value={source}>
              {source} ({groupedResults[source].length})
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="space-y-3">
          {results.map((result) => (
            <Card key={result.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {getSourceIcon(result.source)}
                      {result.title}
                    </CardTitle>
                    <CardDescription className="mt-1">{result.description}</CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge>{result.source}</Badge>
                    <Badge variant="outline">{(result.score * 100).toFixed(0)}% match</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(result.timestamp).toLocaleString()}
                  <span className="ml-2">{result.type}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {Object.entries(groupedResults).map(([source, sourceResults]) => (
          <TabsContent key={source} value={source} className="space-y-3">
            {sourceResults.map((result) => (
              <Card key={result.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{result.title}</CardTitle>
                      <CardDescription className="mt-1">{result.description}</CardDescription>
                    </div>
                    <Badge variant="outline">{(result.score * 100).toFixed(0)}% match</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(result.timestamp).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        ))}
      </Tabs>

      {results.length === 0 && !loading && query && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <SearchIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No results found for &quot;{query}&quot;</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
