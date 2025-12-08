'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, TrendingUp, TrendingDown, Users, Clock, Target, PieChart as PieChartIcon } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';

interface Project {
  id: string;
  name: string;
  clientName: string;
  status: string;
  budgetAmount: number;
  hourlyRate: number;
  profitability: {
    totalRevenue: number;
    totalCosts: number;
    grossProfit: number;
    profitMargin: number;
    utilizationRate: number;
    billableRatio: number;
    profitabilityScore: number;
  };
}

interface ClientScore {
  clientName: string;
  projectCount: number;
  totalRevenue: number;
  totalProfit: number;
  avgProfitMargin: number;
  clientScore: number;
}

export default function ProfitabilityDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clientScores, setClientScores] = useState<ClientScore[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('all-time');

  useEffect(() => {
    fetchData();
  }, [selectedPeriod]);

  const fetchData = async () => {
    try {
      const workspaceId = 'your-workspace-id';
      
      const [projectsRes, clientsRes, summaryRes] = await Promise.all([
        fetch(`/api/profitability/projects/workspace/${workspaceId}`),
        fetch(`/api/profitability/workspace/${workspaceId}/client-scoring`),
        fetch(`/api/profitability/workspace/${workspaceId}/summary?period=${selectedPeriod}`)
      ]);

      setProjects(await projectsRes.json());
      setClientScores(await clientsRes.json());
      setSummary(await summaryRes.json());
    } catch (error) {
      console.error('Failed to fetch profitability data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getProfitabilityLevel = (margin: number) => {
    if (margin >= 30) return { label: 'Excellent', color: 'bg-green-500' };
    if (margin >= 20) return { label: 'Good', color: 'bg-blue-500' };
    if (margin >= 10) return { label: 'Fair', color: 'bg-yellow-500' };
    if (margin >= 0) return { label: 'Low', color: 'bg-orange-500' };
    return { label: 'Loss', color: 'bg-red-500' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Profitability Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Track project profitability and resource utilization
          </p>
        </div>
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-time">All Time</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summary?.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {summary?.period}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${summary?.totalProfit.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.avgProfitMargin.toFixed(1)}% margin
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profitable Projects</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.profitableProjects}</div>
            <p className="text-xs text-muted-foreground">
              of {summary?.totalProjects} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">At Risk</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {summary?.unprofitableProjects}
            </div>
            <p className="text-xs text-muted-foreground">
              Projects need attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Profitability Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Project Profitability Heatmap</CardTitle>
          <CardDescription>Visual overview of project performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => {
              const level = getProfitabilityLevel(project.profitability.profitMargin);
              return (
                <div
                  key={project.id}
                  className="relative p-4 rounded-lg border hover:shadow-lg transition-shadow cursor-pointer"
                  style={{
                    background: `linear-gradient(135deg, ${level.color}15 0%, ${level.color}05 100%)`
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{project.name}</h3>
                      <p className="text-sm text-muted-foreground">{project.clientName}</p>
                    </div>
                    <Badge variant="outline" className={level.color}>
                      {level.label}
                    </Badge>
                  </div>
                  
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Revenue</span>
                      <span className="font-semibold">${project.profitability.totalRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Profit</span>
                      <span className="font-semibold text-green-600">
                        ${project.profitability.grossProfit.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Margin</span>
                      <span className="font-semibold">
                        {project.profitability.profitMargin.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Utilization</span>
                      <span className="font-semibold">
                        {project.profitability.utilizationRate.toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span>Profitability Score</span>
                      <span className="font-semibold">{project.profitability.profitabilityScore}/100</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${level.color}`}
                        style={{ width: `${project.profitability.profitabilityScore}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Revenue vs Cost Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue vs Costs by Project</CardTitle>
          <CardDescription>Financial performance comparison</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={projects.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="profitability.totalRevenue" name="Revenue" fill="#3b82f6" />
              <Bar dataKey="profitability.totalCosts" name="Costs" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Client Profitability Scoring */}
      <Card>
        <CardHeader>
          <CardTitle>Client Profitability Scores</CardTitle>
          <CardDescription>Top clients by profitability and revenue</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {clientScores.slice(0, 10).map((client, index) => (
              <div key={client.clientName} className="flex items-center gap-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent font-semibold text-sm">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-semibold">{client.clientName}</h4>
                    <Badge className={getScoreColor(client.clientScore)}>
                      {client.clientScore}/100
                    </Badge>
                  </div>
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <span>{client.projectCount} project(s)</span>
                    <span>${client.totalRevenue.toLocaleString()} revenue</span>
                    <span>${client.totalProfit.toLocaleString()} profit</span>
                    <span>{client.avgProfitMargin.toFixed(1)}% margin</span>
                  </div>
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${client.clientScore >= 80 ? 'bg-green-500' : client.clientScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${client.clientScore}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Profit Margin Distribution */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profit Margin Distribution</CardTitle>
            <CardDescription>Project distribution by margin range</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={[
                  {
                    range: '< 0%',
                    count: projects.filter(p => p.profitability.profitMargin < 0).length
                  },
                  {
                    range: '0-10%',
                    count: projects.filter(p => p.profitability.profitMargin >= 0 && p.profitability.profitMargin < 10).length
                  },
                  {
                    range: '10-20%',
                    count: projects.filter(p => p.profitability.profitMargin >= 10 && p.profitability.profitMargin < 20).length
                  },
                  {
                    range: '20-30%',
                    count: projects.filter(p => p.profitability.profitMargin >= 20 && p.profitability.profitMargin < 30).length
                  },
                  {
                    range: '30%+',
                    count: projects.filter(p => p.profitability.profitMargin >= 30).length
                  }
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Utilization vs Profitability</CardTitle>
            <CardDescription>Correlation between resource use and profit</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="profitability.utilizationRate" name="Utilization %" unit="%" />
                <YAxis dataKey="profitability.profitMargin" name="Profit Margin" unit="%" />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter
                  name="Projects"
                  data={projects}
                  fill="#3b82f6"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
