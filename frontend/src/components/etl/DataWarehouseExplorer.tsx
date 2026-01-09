'use client';

import React, { useState, useEffect } from 'react';
import {
  Database,
  Table,
  Folder,
  RefreshCw,
  Search,
  Play,
  Download,
  Clock,
  HardDrive,
  BarChart3,
  FileSpreadsheet,
  ChevronRight,
  ChevronDown,
  Plus,
  Eye,
  Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Schema {
  name: string;
  tables: TableInfo[];
}

interface TableInfo {
  name: string;
  type: 'table' | 'view' | 'materialized_view';
  rowCount: number;
  sizeBytes: number;
  columns: ColumnInfo[];
  lastUpdated?: string;
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
}

interface QueryResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  executionTime: number;
}

interface DataWarehouseExplorerProps {
  connectionId?: string;
  className?: string;
}

export function DataWarehouseExplorer({ connectionId, className }: DataWarehouseExplorerProps) {
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'browser' | 'query' | 'jobs'>('browser');

  // Fetch schemas
  useEffect(() => {
    const fetchSchemas = async () => {
      try {
        const response = await fetch(`/api/warehouse/schemas?connectionId=${connectionId || ''}`);
        const data = await response.json();
        setSchemas(data);
        if (data.length > 0) {
          setExpandedSchemas(new Set([data[0].name]));
        }
      } catch (error) {
        console.error('Failed to fetch schemas:', error);
        // Mock data for demo
        setSchemas([
          {
            name: 'analytics',
            tables: [
              {
                name: 'daily_metrics',
                type: 'table',
                rowCount: 1523400,
                sizeBytes: 245000000,
                columns: [
                  { name: 'id', type: 'UUID', nullable: false, isPrimaryKey: true },
                  { name: 'date', type: 'DATE', nullable: false, isPrimaryKey: false },
                  { name: 'metric_name', type: 'VARCHAR(255)', nullable: false, isPrimaryKey: false },
                  { name: 'value', type: 'DOUBLE', nullable: true, isPrimaryKey: false },
                ],
                lastUpdated: new Date().toISOString(),
              },
              {
                name: 'user_sessions',
                type: 'table',
                rowCount: 8924000,
                sizeBytes: 1200000000,
                columns: [
                  { name: 'session_id', type: 'UUID', nullable: false, isPrimaryKey: true },
                  { name: 'user_id', type: 'UUID', nullable: false, isPrimaryKey: false },
                  { name: 'started_at', type: 'TIMESTAMP', nullable: false, isPrimaryKey: false },
                  { name: 'ended_at', type: 'TIMESTAMP', nullable: true, isPrimaryKey: false },
                  { name: 'events', type: 'JSON', nullable: true, isPrimaryKey: false },
                ],
              },
              {
                name: 'monthly_summary',
                type: 'materialized_view',
                rowCount: 360,
                sizeBytes: 5000000,
                columns: [
                  { name: 'month', type: 'DATE', nullable: false, isPrimaryKey: false },
                  { name: 'total_revenue', type: 'DECIMAL(18,2)', nullable: false, isPrimaryKey: false },
                  { name: 'total_users', type: 'BIGINT', nullable: false, isPrimaryKey: false },
                ],
              },
            ],
          },
          {
            name: 'staging',
            tables: [
              {
                name: 'raw_events',
                type: 'table',
                rowCount: 50000000,
                sizeBytes: 8000000000,
                columns: [
                  { name: 'event_id', type: 'UUID', nullable: false, isPrimaryKey: true },
                  { name: 'event_type', type: 'VARCHAR(100)', nullable: false, isPrimaryKey: false },
                  { name: 'payload', type: 'JSON', nullable: true, isPrimaryKey: false },
                  { name: 'timestamp', type: 'TIMESTAMP', nullable: false, isPrimaryKey: false },
                ],
              },
            ],
          },
        ]);
        setExpandedSchemas(new Set(['analytics']));
      }
    };

    fetchSchemas();
  }, [connectionId]);

  // Execute query
  const executeQuery = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/warehouse/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, connectionId }),
      });
      const data = await response.json();
      setQueryResult(data);
    } catch (error) {
      console.error('Failed to execute query:', error);
      // Mock result
      setQueryResult({
        columns: ['id', 'name', 'value'],
        rows: [
          ['1', 'Metric A', '1234.56'],
          ['2', 'Metric B', '2345.67'],
          ['3', 'Metric C', '3456.78'],
        ],
        rowCount: 3,
        executionTime: 125,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const toggleSchema = (schemaName: string) => {
    setExpandedSchemas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(schemaName)) {
        newSet.delete(schemaName);
      } else {
        newSet.add(schemaName);
      }
      return newSet;
    });
  };

  const filteredSchemas = schemas.map(schema => ({
    ...schema,
    tables: schema.tables.filter(t => 
      t.name.toLowerCase().includes(searchTerm.toLowerCase())
    ),
  })).filter(s => s.tables.length > 0 || s.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className={cn('bg-slate-900 rounded-xl overflow-hidden', className)}>
      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => setActiveTab('browser')}
          className={cn(
            'px-4 py-3 text-sm font-medium transition-colors',
            activeTab === 'browser'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-slate-400 hover:text-white'
          )}
        >
          <Database className="w-4 h-4 inline mr-2" />
          Schema Browser
        </button>
        <button
          onClick={() => setActiveTab('query')}
          className={cn(
            'px-4 py-3 text-sm font-medium transition-colors',
            activeTab === 'query'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-slate-400 hover:text-white'
          )}
        >
          <FileSpreadsheet className="w-4 h-4 inline mr-2" />
          Query Editor
        </button>
        <button
          onClick={() => setActiveTab('jobs')}
          className={cn(
            'px-4 py-3 text-sm font-medium transition-colors',
            activeTab === 'jobs'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-slate-400 hover:text-white'
          )}
        >
          <Clock className="w-4 h-4 inline mr-2" />
          Jobs
        </button>
      </div>

      {/* Content */}
      <div className="flex h-[600px]">
        {activeTab === 'browser' && (
          <>
            {/* Schema Tree */}
            <div className="w-72 border-r border-slate-700 overflow-y-auto">
              <div className="p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search tables..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                  />
                </div>
              </div>

              <div className="px-2 pb-4">
                {filteredSchemas.map(schema => (
                  <div key={schema.name}>
                    <button
                      onClick={() => toggleSchema(schema.name)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-800 rounded text-white text-sm"
                    >
                      {expandedSchemas.has(schema.name) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <Folder className="w-4 h-4 text-yellow-400" />
                      <span>{schema.name}</span>
                      <span className="ml-auto text-slate-500 text-xs">
                        {schema.tables.length}
                      </span>
                    </button>

                    {expandedSchemas.has(schema.name) && (
                      <div className="ml-6">
                        {schema.tables.map(table => (
                          <button
                            key={table.name}
                            onClick={() => setSelectedTable(table)}
                            className={cn(
                              'w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm',
                              selectedTable?.name === table.name
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'hover:bg-slate-800 text-slate-300'
                            )}
                          >
                            <Table className="w-4 h-4" />
                            <span className="truncate">{table.name}</span>
                            {table.type === 'view' && (
                              <span className="text-xs text-slate-500">(V)</span>
                            )}
                            {table.type === 'materialized_view' && (
                              <span className="text-xs text-purple-400">(MV)</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Table Details */}
            <div className="flex-1 p-6 overflow-y-auto">
              {selectedTable ? (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-semibold text-white">{selectedTable.name}</h2>
                      <p className="text-sm text-slate-400 capitalize">{selectedTable.type.replace('_', ' ')}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors">
                        <Eye className="w-4 h-4" />
                        Preview Data
                      </button>
                      <button className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors">
                        <Copy className="w-4 h-4" />
                        Copy Query
                      </button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-slate-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <BarChart3 className="w-4 h-4" />
                        <span className="text-sm">Rows</span>
                      </div>
                      <p className="text-xl font-semibold text-white">
                        {selectedTable.rowCount.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <HardDrive className="w-4 h-4" />
                        <span className="text-sm">Size</span>
                      </div>
                      <p className="text-xl font-semibold text-white">
                        {formatBytes(selectedTable.sizeBytes)}
                      </p>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm">Last Updated</span>
                      </div>
                      <p className="text-xl font-semibold text-white">
                        {selectedTable.lastUpdated 
                          ? new Date(selectedTable.lastUpdated).toLocaleDateString()
                          : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Columns */}
                  <h3 className="text-lg font-medium text-white mb-4">Columns</h3>
                  <div className="bg-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-slate-700">
                        <tr className="text-left text-xs text-slate-400">
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Nullable</th>
                          <th className="px-4 py-3">Key</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedTable.columns.map(col => (
                          <tr key={col.name} className="border-t border-slate-700">
                            <td className="px-4 py-3 text-white font-mono text-sm">{col.name}</td>
                            <td className="px-4 py-3 text-blue-400 font-mono text-sm">{col.type}</td>
                            <td className="px-4 py-3 text-slate-300 text-sm">
                              {col.nullable ? 'Yes' : 'No'}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {col.isPrimaryKey && (
                                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                                  PK
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Database className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">Select a table to view details</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'query' && (
          <div className="flex-1 flex flex-col">
            {/* Query Editor */}
            <div className="p-4 border-b border-slate-700">
              <div className="flex items-center gap-4 mb-4">
                <button
                  onClick={executeQuery}
                  disabled={loading || !query.trim()}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded text-sm transition-colors',
                    loading || !query.trim()
                      ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  )}
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Run Query
                </button>
                <button className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors">
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
              <textarea
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="SELECT * FROM analytics.daily_metrics LIMIT 100"
                className="w-full h-32 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm resize-none"
              />
            </div>

            {/* Query Results */}
            <div className="flex-1 overflow-auto p-4">
              {queryResult ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-slate-400">
                      {queryResult.rowCount} rows returned in {queryResult.executionTime}ms
                    </p>
                  </div>
                  <div className="bg-slate-800 rounded-lg overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-700">
                        <tr>
                          {queryResult.columns.map(col => (
                            <th key={col} className="px-4 py-3 text-left text-xs text-slate-400 font-medium">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {queryResult.rows.map((row, i) => (
                          <tr key={i} className="border-t border-slate-700 hover:bg-slate-700/50">
                            {row.map((cell, j) => (
                              <td key={j} className="px-4 py-2 text-sm text-slate-300 font-mono">
                                {cell === null ? (
                                  <span className="text-slate-500 italic">NULL</span>
                                ) : (
                                  String(cell)
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <FileSpreadsheet className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">Run a query to see results</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="flex-1 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Scheduled Jobs</h2>
              <button className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors">
                <Plus className="w-4 h-4" />
                Create Job
              </button>
            </div>
            
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No scheduled jobs</p>
              <p className="text-slate-500 text-sm">Create a job to run queries on a schedule</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DataWarehouseExplorer;
