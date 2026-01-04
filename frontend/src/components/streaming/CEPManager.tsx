'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Bell,
  Plus,
  Trash2,
  Edit,
  Eye,
  Clock,
  Zap,
  GitBranch,
  TrendingUp,
  TrendingDown,
  Hash,
  Link2,
  Webhook,
  Mail,
  CheckCircle,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CEPRule {
  id: string;
  name: string;
  description?: string;
  pattern: {
    type: 'sequence' | 'absence' | 'frequency' | 'correlation' | 'threshold' | 'trend';
    conditions: any[];
  };
  timeWindow: number;
  action: {
    type: 'alert' | 'email' | 'webhook' | 'aggregate' | 'trigger_flow' | 'emit';
    config: any;
  };
  enabled: boolean;
  priority: number;
}

interface PatternMatch {
  ruleId: string;
  ruleName: string;
  matchedEvents: any[];
  matchTime: Date;
  pattern: any;
}

interface CEPManagerProps {
  className?: string;
}

export function CEPManager({ className }: CEPManagerProps) {
  const [rules, setRules] = useState<CEPRule[]>([]);
  const [matches, setMatches] = useState<PatternMatch[]>([]);
  const [stats, setStats] = useState({
    activeRules: 0,
    totalRules: 0,
    bufferedEvents: 0,
    recentMatches: 0,
    partialMatches: 0,
  });
  const [selectedRule, setSelectedRule] = useState<CEPRule | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'rules' | 'matches'>('rules');

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rulesRes, matchesRes, statsRes] = await Promise.all([
          fetch('/api/streaming/cep/rules'),
          fetch('/api/streaming/cep/matches?limit=50'),
          fetch('/api/streaming/cep/stats'),
        ]);

        setRules(await rulesRes.json());
        setMatches(await matchesRes.json());
        setStats(await statsRes.json());
      } catch (error) {
        console.error('Failed to fetch CEP data:', error);
        // Mock data
        setRules([
          {
            id: 'rule-1',
            name: 'High Error Rate',
            description: 'Alert when error rate exceeds threshold',
            pattern: {
              type: 'frequency',
              conditions: [{ eventType: 'error', minOccurrences: 10 }],
            },
            timeWindow: 60000,
            action: { type: 'alert', config: { severity: 'high' } },
            enabled: true,
            priority: 1,
          },
          {
            id: 'rule-2',
            name: 'Checkout Abandonment',
            description: 'Detect when user adds to cart but doesn\'t purchase',
            pattern: {
              type: 'sequence',
              conditions: [
                { eventType: 'add_to_cart', alias: 'cart' },
                { eventType: 'purchase', optional: true },
              ],
            },
            timeWindow: 900000, // 15 minutes
            action: { type: 'email', config: { template: 'cart-reminder' } },
            enabled: true,
            priority: 2,
          },
          {
            id: 'rule-3',
            name: 'Traffic Spike',
            description: 'Detect sudden increase in traffic',
            pattern: {
              type: 'trend',
              conditions: [
                { eventType: 'page_view', field: 'count', value: 'increasing' },
              ],
            },
            timeWindow: 300000, // 5 minutes
            action: { type: 'webhook', config: { url: '/api/scaling/trigger' } },
            enabled: false,
            priority: 3,
          },
        ]);
        setMatches([
          {
            ruleId: 'rule-1',
            ruleName: 'High Error Rate',
            matchedEvents: Array(12).fill({ type: 'error' }),
            matchTime: new Date(Date.now() - 120000),
            pattern: { type: 'frequency' },
          },
          {
            ruleId: 'rule-2',
            ruleName: 'Checkout Abandonment',
            matchedEvents: [{ type: 'add_to_cart' }],
            matchTime: new Date(Date.now() - 600000),
            pattern: { type: 'sequence' },
          },
        ]);
        setStats({
          activeRules: 2,
          totalRules: 3,
          bufferedEvents: 1523,
          recentMatches: 47,
          partialMatches: 12,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const toggleRule = async (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;

    try {
      await fetch(`/api/streaming/cep/rules/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }

    setRules(rs => rs.map(r => 
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    ));
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      await fetch(`/api/streaming/cep/rules/${ruleId}`, { method: 'DELETE' });
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }

    setRules(rs => rs.filter(r => r.id !== ruleId));
    if (selectedRule?.id === ruleId) {
      setSelectedRule(null);
    }
  };

  const getPatternIcon = (type: string) => {
    switch (type) {
      case 'sequence': return GitBranch;
      case 'absence': return XCircle;
      case 'frequency': return Hash;
      case 'correlation': return Link2;
      case 'threshold': return AlertTriangle;
      case 'trend': return TrendingUp;
      default: return Zap;
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'alert': return Bell;
      case 'email': return Mail;
      case 'webhook': return Webhook;
      default: return Zap;
    }
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
      {/* Stats Bar */}
      <div className="grid grid-cols-5 gap-4 p-4 bg-slate-800 border-b border-slate-700">
        <div className="text-center">
          <p className="text-2xl font-semibold text-white">{stats.activeRules}</p>
          <p className="text-xs text-slate-400">Active Rules</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-semibold text-white">{stats.totalRules}</p>
          <p className="text-xs text-slate-400">Total Rules</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-semibold text-blue-400">{stats.bufferedEvents.toLocaleString()}</p>
          <p className="text-xs text-slate-400">Buffered Events</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-semibold text-green-400">{stats.recentMatches}</p>
          <p className="text-xs text-slate-400">Recent Matches</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-semibold text-yellow-400">{stats.partialMatches}</p>
          <p className="text-xs text-slate-400">Partial Matches</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => setActiveTab('rules')}
          className={cn(
            'px-6 py-3 text-sm font-medium transition-colors',
            activeTab === 'rules'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-slate-400 hover:text-white'
          )}
        >
          Rules ({rules.length})
        </button>
        <button
          onClick={() => setActiveTab('matches')}
          className={cn(
            'px-6 py-3 text-sm font-medium transition-colors',
            activeTab === 'matches'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-slate-400 hover:text-white'
          )}
        >
          Pattern Matches ({matches.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex h-[500px]">
        {activeTab === 'rules' && (
          <>
            {/* Rules List */}
            <div className="w-1/2 border-r border-slate-700 overflow-y-auto">
              <div className="p-4">
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors mb-4"
                >
                  <Plus className="w-4 h-4" />
                  Create Rule
                </button>

                <div className="space-y-3">
                  {rules.map(rule => {
                    const PatternIcon = getPatternIcon(rule.pattern.type);
                    const ActionIcon = getActionIcon(rule.action.type);

                    return (
                      <div
                        key={rule.id}
                        onClick={() => setSelectedRule(rule)}
                        className={cn(
                          'p-4 rounded-lg border cursor-pointer transition-colors',
                          selectedRule?.id === rule.id
                            ? 'bg-blue-600/20 border-blue-500'
                            : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'p-2 rounded',
                              rule.enabled ? 'bg-green-500/20' : 'bg-slate-700'
                            )}>
                              <PatternIcon className={cn(
                                'w-4 h-4',
                                rule.enabled ? 'text-green-400' : 'text-slate-400'
                              )} />
                            </div>
                            <div>
                              <p className="text-white font-medium">{rule.name}</p>
                              <p className="text-xs text-slate-400 capitalize">
                                {rule.pattern.type} pattern
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                toggleRule(rule.id);
                              }}
                              className={cn(
                                'w-10 h-6 rounded-full transition-colors relative',
                                rule.enabled ? 'bg-green-500' : 'bg-slate-600'
                              )}
                            >
                              <div className={cn(
                                'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                                rule.enabled ? 'left-5' : 'left-1'
                              )} />
                            </button>
                          </div>
                        </div>

                        {rule.description && (
                          <p className="text-sm text-slate-400 mb-2">{rule.description}</p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {rule.timeWindow / 1000}s window
                          </span>
                          <span className="flex items-center gap-1">
                            <ActionIcon className="w-3 h-3" />
                            {rule.action.type}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Rule Details */}
            <div className="w-1/2 p-6 overflow-y-auto">
              {selectedRule ? (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-white">{selectedRule.name}</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsEditing(true)}
                        className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteRule(selectedRule.id)}
                        className="p-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-medium text-slate-400 mb-2">Pattern Type</h4>
                      <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm capitalize">
                        {selectedRule.pattern.type}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-slate-400 mb-2">Conditions</h4>
                      <div className="bg-slate-800 rounded-lg p-4 font-mono text-sm text-slate-300">
                        <pre>{JSON.stringify(selectedRule.pattern.conditions, null, 2)}</pre>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-slate-400 mb-2">Time Window</h4>
                      <p className="text-white">{selectedRule.timeWindow / 1000} seconds</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-slate-400 mb-2">Action</h4>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm capitalize">
                          {selectedRule.action.type}
                        </span>
                      </div>
                      <div className="mt-2 bg-slate-800 rounded-lg p-4 font-mono text-sm text-slate-300">
                        <pre>{JSON.stringify(selectedRule.action.config, null, 2)}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Zap className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">Select a rule to view details</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'matches' && (
          <div className="flex-1 overflow-y-auto p-4">
            {matches.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <CheckCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">No pattern matches yet</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {matches.map((match, i) => (
                  <div
                    key={i}
                    className="bg-slate-800 rounded-lg p-4 border border-slate-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-500/20 rounded">
                          <Zap className="w-4 h-4 text-yellow-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{match.ruleName}</p>
                          <p className="text-xs text-slate-400">
                            {new Date(match.matchTime).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm text-slate-400">
                        {match.matchedEvents.length} events
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 capitalize">
                      Pattern: {match.pattern.type}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CEPManager;
