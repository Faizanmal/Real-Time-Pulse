'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Play,
  Pause,
  Settings,
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  Radio,
  BarChart3,
  Clock,
  TrendingUp,
  Filter,
  Database,
  Webhook,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stream {
  id: string;
  name: string;
  topics: string[];
  status: 'running' | 'paused' | 'error';
  metrics?: {
    messagesProcessed: number;
    bytesProcessed: number;
    errorsCount: number;
    latencyMs: number[];
    lastMessageTime: Date;
  };
}

interface StreamEvent {
  id: string;
  type: string;
  timestamp: Date;
  data: any;
  streamId: string;
}

interface StreamingDashboardProps {
  className?: string;
}

export function StreamingDashboard({ className }: StreamingDashboardProps) {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [selectedStream, setSelectedStream] = useState<Stream | null>(null);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const eventsContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch streams
  useEffect(() => {
    const fetchStreams = async () => {
      try {
        const response = await fetch('/api/streaming/streams');
        const data = await response.json();
        setStreams(data);
      } catch (error) {
        console.error('Failed to fetch streams:', error);
        // Mock data
        setStreams([
          {
            id: 'stream-1',
            name: 'User Events',
            topics: ['user-events'],
            status: 'running',
            metrics: {
              messagesProcessed: 125430,
              bytesProcessed: 52000000,
              errorsCount: 3,
              latencyMs: [12, 15, 8, 22, 11, 14],
              lastMessageTime: new Date(),
            },
          },
          {
            id: 'stream-2',
            name: 'Metrics Pipeline',
            topics: ['metrics'],
            status: 'running',
            metrics: {
              messagesProcessed: 892100,
              bytesProcessed: 234000000,
              errorsCount: 0,
              latencyMs: [5, 7, 4, 6, 5],
              lastMessageTime: new Date(),
            },
          },
          {
            id: 'stream-3',
            name: 'Error Logs',
            topics: ['logs'],
            status: 'paused',
            metrics: {
              messagesProcessed: 45230,
              bytesProcessed: 18000000,
              errorsCount: 12,
              latencyMs: [25, 30, 22, 28],
              lastMessageTime: new Date(Date.now() - 300000),
            },
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchStreams();
    const interval = setInterval(fetchStreams, 5000);
    return () => clearInterval(interval);
  }, []);

  // WebSocket for real-time events
  useEffect(() => {
    if (!selectedStream) return;

    // Connect to WebSocket for live events
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/streaming/ws`);
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', streamId: selectedStream.id }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'event') {
        setEvents(prev => [...prev.slice(-99), data.event]);
      }
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [selectedStream]);

  // Auto-scroll events
  useEffect(() => {
    if (autoScroll && eventsContainerRef.current) {
      eventsContainerRef.current.scrollTop = eventsContainerRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  // Simulate events for demo
  useEffect(() => {
    if (!selectedStream) return;

    const interval = setInterval(() => {
      const eventTypes = ['click', 'page_view', 'purchase', 'signup', 'api_call'];
      const newEvent: StreamEvent = {
        id: `evt-${Date.now()}`,
        type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
        timestamp: new Date(),
        data: {
          userId: `user-${Math.floor(Math.random() * 1000)}`,
          value: Math.random() * 100,
          source: ['web', 'mobile', 'api'][Math.floor(Math.random() * 3)],
        },
        streamId: selectedStream.id,
      };
      setEvents(prev => [...prev.slice(-99), newEvent]);
    }, 500);

    return () => clearInterval(interval);
  }, [selectedStream]);

  const toggleStream = async (streamId: string) => {
    const stream = streams.find(s => s.id === streamId);
    if (!stream) return;

    const newStatus = stream.status === 'running' ? 'paused' : 'running';
    
    try {
      await fetch(`/api/streaming/streams/${streamId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (error) {
      console.error('Failed to toggle stream:', error);
    }

    setStreams(s => s.map(stream => 
      stream.id === streamId 
        ? { ...stream, status: newStatus } 
        : stream
    ));
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const getAvgLatency = (latencies: number[]) => {
    if (!latencies.length) return 0;
    return Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  };

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center h-96', className)}>
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className={cn('bg-slate-900 rounded-xl overflow-hidden', className)}>
      <div className="flex h-[700px]">
        {/* Streams List */}
        <div className="w-80 border-r border-slate-700 flex flex-col">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Streams</h2>
            <button
              onClick={() => setIsCreating(true)}
              className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {streams.map(stream => (
              <button
                key={stream.id}
                onClick={() => {
                  setSelectedStream(stream);
                  setEvents([]);
                }}
                className={cn(
                  'w-full p-4 rounded-lg text-left transition-colors',
                  selectedStream?.id === stream.id
                    ? 'bg-blue-600/20 border border-blue-500'
                    : 'bg-slate-800 hover:bg-slate-700 border border-transparent'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium">{stream.name}</span>
                  <div className="flex items-center gap-2">
                    {stream.status === 'running' && (
                      <span className="flex items-center gap-1 text-xs text-green-400">
                        <Radio className="w-3 h-3 animate-pulse" />
                        Live
                      </span>
                    )}
                    {stream.status === 'paused' && (
                      <span className="text-xs text-yellow-400">Paused</span>
                    )}
                    {stream.status === 'error' && (
                      <span className="text-xs text-red-400">Error</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <span>{stream.topics.join(', ')}</span>
                </div>
                {stream.metrics && (
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                    <span>{stream.metrics.messagesProcessed.toLocaleString()} msgs</span>
                    <span>{getAvgLatency(stream.metrics.latencyMs)}ms avg</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Stream Details */}
        {selectedStream ? (
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">{selectedStream.name}</h3>
                <p className="text-sm text-slate-400">Topics: {selectedStream.topics.join(', ')}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleStream(selectedStream.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded text-sm transition-colors',
                    selectedStream.status === 'running'
                      ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  )}
                >
                  {selectedStream.status === 'running' ? (
                    <>
                      <Pause className="w-4 h-4" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Resume
                    </>
                  )}
                </button>
                <button className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors">
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Metrics */}
            {selectedStream.metrics && (
              <div className="grid grid-cols-4 gap-4 p-4 border-b border-slate-700">
                <div className="bg-slate-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-slate-400 mb-1">
                    <Zap className="w-4 h-4" />
                    <span className="text-xs">Messages</span>
                  </div>
                  <p className="text-xl font-semibold text-white">
                    {selectedStream.metrics.messagesProcessed.toLocaleString()}
                  </p>
                </div>
                <div className="bg-slate-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-slate-400 mb-1">
                    <Database className="w-4 h-4" />
                    <span className="text-xs">Data Processed</span>
                  </div>
                  <p className="text-xl font-semibold text-white">
                    {formatBytes(selectedStream.metrics.bytesProcessed)}
                  </p>
                </div>
                <div className="bg-slate-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-slate-400 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs">Avg Latency</span>
                  </div>
                  <p className="text-xl font-semibold text-white">
                    {getAvgLatency(selectedStream.metrics.latencyMs)}ms
                  </p>
                </div>
                <div className="bg-slate-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-slate-400 mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs">Errors</span>
                  </div>
                  <p className={cn(
                    'text-xl font-semibold',
                    selectedStream.metrics.errorsCount > 0 ? 'text-red-400' : 'text-green-400'
                  )}>
                    {selectedStream.metrics.errorsCount}
                  </p>
                </div>
              </div>
            )}

            {/* Live Events */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                <h4 className="text-sm font-medium text-white">Live Events</h4>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-400">
                    <input
                      type="checkbox"
                      checked={autoScroll}
                      onChange={e => setAutoScroll(e.target.checked)}
                      className="rounded"
                    />
                    Auto-scroll
                  </label>
                  <button
                    onClick={() => setEvents([])}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div
                ref={eventsContainerRef}
                className="flex-1 overflow-y-auto p-2 font-mono text-xs"
              >
                {events.map(event => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 p-2 hover:bg-slate-800 rounded"
                  >
                    <span className="text-slate-500 shrink-0">
                      {event.timestamp.toLocaleTimeString()}
                    </span>
                    <span className={cn(
                      'px-2 py-0.5 rounded text-xs shrink-0',
                      event.type === 'error' && 'bg-red-500/20 text-red-400',
                      event.type === 'purchase' && 'bg-green-500/20 text-green-400',
                      event.type === 'signup' && 'bg-purple-500/20 text-purple-400',
                      event.type === 'click' && 'bg-blue-500/20 text-blue-400',
                      event.type === 'page_view' && 'bg-yellow-500/20 text-yellow-400',
                      event.type === 'api_call' && 'bg-cyan-500/20 text-cyan-400'
                    )}>
                      {event.type}
                    </span>
                    <span className="text-slate-300 break-all">
                      {JSON.stringify(event.data)}
                    </span>
                  </div>
                ))}

                {events.length === 0 && (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    Waiting for events...
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Activity className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">Select a stream to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StreamingDashboard;
