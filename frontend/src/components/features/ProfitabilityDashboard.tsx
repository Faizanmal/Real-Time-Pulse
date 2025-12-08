'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign, TrendingUp, TrendingDown, Users, Clock,
  Plus, RefreshCw, BarChart3, PieChart
} from 'lucide-react';
import { profitabilityApi } from '@/lib/api-client';

export default function ProfitabilityDashboard({ workspaceId }: { workspaceId: string }) {
  const [projects, setProjects] = useState<any[]>([]);
  const [heatmap, setHeatmap] = useState<any[]>([]);
  const [clientScoring, setClientScoring] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [workspaceId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [projectsRes, heatmapRes, scoringRes, summaryRes] = await Promise.all([
        profitabilityApi.getProjects(workspaceId, 'ACTIVE'),
        profitabilityApi.getHeatmap(workspaceId),
        profitabilityApi.getClientScoring(workspaceId),
        profitabilityApi.getSummary(workspaceId, 'month'),
      ]);
      setProjects(projectsRes.data);
      setHeatmap(heatmapRes.data);
      setClientScoring(scoringRes.data);
      setSummary(summaryRes.data);
    } catch (error) {
      console.error('Failed to load profitability data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getMarginColor = (margin: number) => {
    if (margin >= 30) return 'text-green-600';
    if (margin >= 20) return 'text-blue-600';
    if (margin >= 10) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Profitability Analytics</h2>
          <p className="text-gray-600 mt-1">Track project profitability and client value</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold mt-1">${summary.totalRevenue.toLocaleString()}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Profit</p>
                <p className="text-2xl font-bold mt-1">${summary.totalProfit.toLocaleString()}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Margin</p>
                <p className="text-2xl font-bold mt-1">{summary.avgProfitMargin.toFixed(1)}%</p>
              </div>
              <PieChart className="h-8 w-8 text-purple-500" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Projects</p>
                <p className="text-2xl font-bold mt-1">{summary.totalProjects}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-500" />
            </div>
          </Card>
        </div>
      )}

      {/* Profitability Heatmap */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Project Profitability Heatmap</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {heatmap.map((project) => (
            <div
              key={project.id}
              className="p-4 border rounded-lg hover:shadow-lg transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-semibold">{project.name}</h4>
                  <p className="text-sm text-gray-600">{project.clientName}</p>
                </div>
                <div className={`w-3 h-3 rounded-full ${getScoreColor(project.profitabilityScore)}`} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Profit Margin:</span>
                  <span className={`font-semibold ${getMarginColor(project.profitMargin)}`}>
                    {project.profitMargin.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Gross Profit:</span>
                  <span className="font-semibold">${project.grossProfit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Score:</span>
                  <span className="font-semibold">{project.profitabilityScore}/100</span>
                </div>
              </div>
              <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getScoreColor(project.profitabilityScore)}`}
                  style={{ width: `${project.profitabilityScore}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Client Profitability Scoring */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Client Profitability Scoring</h3>
        <div className="space-y-3">
          {clientScoring.slice(0, 10).map((client, index) => (
            <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-4 flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${getScoreColor(client.clientScore)}`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold">{client.clientName}</h4>
                  <p className="text-sm text-gray-600">{client.projectCount} projects</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">${client.totalRevenue.toLocaleString()}</p>
                <p className={`text-sm ${getMarginColor(client.avgProfitMargin)}`}>
                  {client.avgProfitMargin.toFixed(1)}% margin
                </p>
              </div>
              <div className="ml-6">
                <div className="w-16 h-16 relative">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="#e5e7eb"
                      strokeWidth="4"
                      fill="none"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke={client.clientScore >= 80 ? '#22c55e' : client.clientScore >= 60 ? '#eab308' : '#ef4444'}
                      strokeWidth="4"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 28}`}
                      strokeDashoffset={`${2 * Math.PI * 28 * (1 - client.clientScore / 100)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold">{client.clientScore}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Active Projects Table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Active Projects</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Project</th>
                <th className="text-left py-3 px-4">Client</th>
                <th className="text-right py-3 px-4">Hours</th>
                <th className="text-right py-3 px-4">Billable</th>
                <th className="text-right py-3 px-4">Budget</th>
                <th className="text-center py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{project.name}</td>
                  <td className="py-3 px-4">{project.clientName}</td>
                  <td className="py-3 px-4 text-right">{project.totalHours.toFixed(1)}h</td>
                  <td className="py-3 px-4 text-right">{project.billableHours.toFixed(1)}h</td>
                  <td className="py-3 px-4 text-right">${project.budgetAmount?.toLocaleString() || 'N/A'}</td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant={project.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {project.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
