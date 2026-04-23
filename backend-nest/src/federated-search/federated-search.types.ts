export interface SearchResult {
  id: string;
  type: 'portal' | 'widget' | 'integration' | 'user' | 'insight' | 'external';
  source: string;
  title: string;
  description?: string;
  snippet?: string;
  url?: string;
  relevanceScore: number;
  metadata?: Record<string, any>;
  highlights?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SearchOptions {
  query: string;
  sources?: string[];
  types?: string[];
  dateRange?: { from?: Date; to?: Date };
  limit?: number;
  offset?: number;
  semantic?: boolean;
  correlate?: boolean;
}

export interface DataSource {
  id: string;
  name: string;
  type: 'internal' | 'integration' | 'external';
  connector?: string;
  config?: Record<string, any>;
  isActive: boolean;
}
