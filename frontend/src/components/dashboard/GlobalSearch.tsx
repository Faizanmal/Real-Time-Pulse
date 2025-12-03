'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  X,
  Filter,
  Save,
  Clock,
  Trash2,
  ChevronDown,
  FileText,
  Layout,
  Bell,
  Link2,
  MessageSquare,
  Plug,
} from 'lucide-react';
import {
  advancedSearchApi,
  SearchResult,
  SearchFilter,
  SearchPreset,
  GlobalSearchResponse,
} from '@/src/lib/enterprise-api';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Card } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/src/components/ui/dropdown-menu';
import { Checkbox } from '@/src/components/ui/checkbox';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';
import { useDebouncedCallback } from 'use-debounce';

interface GlobalSearchProps {
  className?: string;
  onResultClick?: (result: SearchResult) => void;
  placeholder?: string;
}

const ENTITY_TYPES = [
  { value: 'portal', label: 'Portals', icon: Layout },
  { value: 'widget', label: 'Widgets', icon: FileText },
  { value: 'alert', label: 'Alerts', icon: Bell },
  { value: 'integration', label: 'Integrations', icon: Plug },
  { value: 'report', label: 'Reports', icon: FileText },
  { value: 'comment', label: 'Comments', icon: MessageSquare },
];

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'createdAt', label: 'Newest First' },
  { value: 'updatedAt', label: 'Recently Updated' },
  { value: 'title', label: 'Alphabetical' },
];

export function GlobalSearch({
  className,
  onResultClick,
  placeholder = 'Search portals, widgets, alerts...',
}: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [presets, setPresets] = useState<SearchPreset[]>([]);
  const [recentSearches, setRecentSearches] = useState<{ query: string; timestamp: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('relevance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState<SearchFilter[]>([]);
  const [facets, setFacets] = useState<GlobalSearchResponse['facets'] | null>(null);
  const [totalResults, setTotalResults] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [presetName, setPresetName] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load presets and recent searches on mount
  useEffect(() => {
    loadPresets();
    loadRecentSearches();
  }, []);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl + K to focus search
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setShowResults(true);
      }
      // Escape to close
      if (event.key === 'Escape') {
        setShowResults(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadPresets = async () => {
    try {
      const data = await advancedSearchApi.getPresets();
      setPresets(data);
    } catch (error) {
      console.error('Failed to load presets:', error);
    }
  };

  const loadRecentSearches = async () => {
    try {
      const data = await advancedSearchApi.getRecentSearches();
      setRecentSearches(data);
    } catch (error) {
      console.error('Failed to load recent searches:', error);
    }
  };

  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setTotalResults(0);
        return;
      }

      setLoading(true);
      try {
        const response = await advancedSearchApi.globalSearch({
          query: searchQuery,
          types: selectedTypes.length > 0 ? selectedTypes : undefined,
          filters: filters.length > 0 ? filters : undefined,
          sortBy: sortBy !== 'relevance' ? sortBy : undefined,
          sortOrder,
        });

        setResults(response.results);
        setTotalResults(response.total);
        setFacets(response.facets);
        if (response.suggestions) {
          setSuggestions(response.suggestions);
        }
      } catch (error) {
        console.error('Search failed:', error);
        toast.error('Search failed');
      } finally {
        setLoading(false);
      }
    },
    [selectedTypes, filters, sortBy, sortOrder]
  );

  const debouncedSearch = useDebouncedCallback(performSearch, 300);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    debouncedSearch(value);
  };

  const handleSuggestionClick = async (suggestion: string) => {
    setQuery(suggestion);
    await performSearch(suggestion);
  };

  const handleTypeToggle = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleResultClick = (result: SearchResult) => {
    setShowResults(false);
    onResultClick?.(result);
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      toast.error('Please enter a preset name');
      return;
    }

    try {
      const newPreset = await advancedSearchApi.savePreset({
        name: presetName,
        filters,
        sortBy: sortBy !== 'relevance' ? sortBy : undefined,
        sortOrder,
      });

      setPresets((prev) => [...prev, newPreset]);
      setPresetName('');
      setSavePresetOpen(false);
      toast.success('Search preset saved');
    } catch (error) {
      console.error('Failed to save preset:', error);
      toast.error('Failed to save preset');
    }
  };

  const handleApplyPreset = (preset: SearchPreset) => {
    setFilters(preset.filters);
    if (preset.sortBy) setSortBy(preset.sortBy);
    if (preset.sortOrder) setSortOrder(preset.sortOrder);
    performSearch(query);
    toast.success(`Applied preset: ${preset.name}`);
  };

  const handleDeletePreset = async (presetId: string) => {
    try {
      await advancedSearchApi.deletePreset(presetId);
      setPresets((prev) => prev.filter((p) => p.id !== presetId));
      toast.success('Preset deleted');
    } catch (error) {
      console.error('Failed to delete preset:', error);
      toast.error('Failed to delete preset');
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setTotalResults(0);
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const getResultIcon = (type: string) => {
    const entityType = ENTITY_TYPES.find((t) => t.value === type);
    if (entityType) {
      const Icon = entityType.icon;
      return <Icon className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  const getResultBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      portal: 'bg-blue-100 text-blue-800',
      widget: 'bg-green-100 text-green-800',
      alert: 'bg-red-100 text-red-800',
      integration: 'bg-purple-100 text-purple-800',
      report: 'bg-orange-100 text-orange-800',
      comment: 'bg-gray-100 text-gray-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => setShowResults(true)}
          placeholder={placeholder}
          className="pl-10 pr-24"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={clearSearch}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-6 px-2', showFilters && 'bg-blue-50 text-blue-600')}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
          </Button>
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-gray-50 px-1.5 text-[10px] font-medium text-gray-500">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      </div>

      {/* Filters Bar */}
      {showFilters && (
        <Card className="mt-2 p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Entity Types */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-500">Type:</span>
              <div className="flex flex-wrap gap-2">
                {ENTITY_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-sm',
                      selectedTypes.includes(type.value)
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    <Checkbox
                      checked={selectedTypes.includes(type.value)}
                      onCheckedChange={() => handleTypeToggle(type.value)}
                      className="h-3 w-3"
                    />
                    {type.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-500">Sort:</span>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[150px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Presets */}
            <div className="flex items-center gap-2 ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Clock className="h-4 w-4 mr-2" />
                    Presets
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {presets.length === 0 ? (
                    <div className="px-2 py-4 text-center text-sm text-gray-500">
                      No saved presets
                    </div>
                  ) : (
                    presets.map((preset) => (
                      <DropdownMenuItem
                        key={preset.id}
                        className="flex items-center justify-between"
                      >
                        <span
                          className="flex-1 cursor-pointer"
                          onClick={() => handleApplyPreset(preset)}
                        >
                          {preset.name}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePreset(preset.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </DropdownMenuItem>
                    ))
                  )}
                  <DropdownMenuSeparator />
                  <Dialog open={savePresetOpen} onOpenChange={setSavePresetOpen}>
                    <DialogTrigger asChild>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Save className="h-4 w-4 mr-2" />
                        Save Current Filters
                      </DropdownMenuItem>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Save Search Preset</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <Input
                          placeholder="Preset name"
                          value={presetName}
                          onChange={(e) => setPresetName(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setSavePresetOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button onClick={handleSavePreset}>Save</Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </Card>
      )}

      {/* Results Dropdown */}
      {showResults && (
        <Card className="absolute z-50 w-full mt-2 max-h-[60vh] overflow-y-auto shadow-lg">
          {loading ? (
            <div className="p-4 text-center">
              <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Searching...</p>
            </div>
          ) : query ? (
            <>
              {/* Results */}
              {results.length > 0 ? (
                <div>
                  <div className="px-4 py-2 bg-gray-50 border-b text-sm text-gray-500">
                    {totalResults} result{totalResults !== 1 ? 's' : ''} found
                  </div>
                  <div className="divide-y">
                    {results.map((result) => (
                      <div
                        key={`${result.type}-${result.id}`}
                        className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => handleResultClick(result)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1 text-gray-400">
                            {getResultIcon(result.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">
                                {result.title}
                              </span>
                              <Badge className={getResultBadgeColor(result.type)}>
                                {result.type}
                              </Badge>
                            </div>
                            {result.description && (
                              <p className="text-sm text-gray-500 truncate mt-1">
                                {result.description}
                              </p>
                            )}
                            {result.highlights && result.highlights.length > 0 && (
                              <p
                                className="text-sm text-gray-600 mt-1"
                                dangerouslySetInnerHTML={{
                                  __html: result.highlights[0],
                                }}
                              />
                            )}
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(result.updatedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-xs text-gray-400">
                            Score: {result.score.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Facets */}
                  {facets && (
                    <div className="px-4 py-3 bg-gray-50 border-t">
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(facets.type).map(([type, count]) => (
                          <Badge
                            key={type}
                            variant="outline"
                            className="cursor-pointer hover:bg-gray-100"
                            onClick={() => {
                              setSelectedTypes([type]);
                              performSearch(query);
                            }}
                          >
                            {type}: {count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Search className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No results found for "{query}"</p>
                  {suggestions.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm text-gray-400 mb-2">Did you mean:</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {suggestions.map((suggestion) => (
                          <Badge
                            key={suggestion}
                            variant="secondary"
                            className="cursor-pointer hover:bg-gray-200"
                            onClick={() => handleSuggestionClick(suggestion)}
                          >
                            {suggestion}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Recent Searches */
            <div>
              {recentSearches.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-gray-50 border-b text-sm font-medium text-gray-500">
                    Recent Searches
                  </div>
                  <div className="divide-y">
                    {recentSearches.slice(0, 5).map((search, i) => (
                      <div
                        key={i}
                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center gap-3"
                        onClick={() => handleSuggestionClick(search.query)}
                      >
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="flex-1">{search.query}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(search.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {presets.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-gray-50 border-b text-sm font-medium text-gray-500">
                    Saved Presets
                  </div>
                  <div className="divide-y">
                    {presets.slice(0, 5).map((preset) => (
                      <div
                        key={preset.id}
                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center gap-3"
                        onClick={() => handleApplyPreset(preset)}
                      >
                        <Save className="h-4 w-4 text-gray-400" />
                        <span className="flex-1">{preset.name}</span>
                        <Badge variant="outline">
                          {preset.filters.length} filters
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {recentSearches.length === 0 && presets.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <Search className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p>Start typing to search</p>
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
