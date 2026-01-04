'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Shield,
  AlertTriangle,
  FileText,
  PieChart,
  BarChart3,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Lock,
  Eye,
} from 'lucide-react';

interface Position {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  percentChange: number;
}

interface FraudAlert {
  id: string;
  transactionId: string;
  timestamp: string;
  amount: number;
  riskScore: number;
  indicators: string[];
  status: 'pending' | 'investigating' | 'confirmed' | 'dismissed';
}

interface SOXControl {
  id: string;
  name: string;
  category: string;
  status: 'effective' | 'deficient' | 'material_weakness';
  lastTested: string;
}

export default function FinanceDashboard() {
  const [portfolio] = useState({
    totalValue: 1250000,
    cash: 125000,
    unrealizedPnL: 45230,
    realizedPnL: 28500,
    positions: [
      { symbol: 'AAPL', quantity: 500, avgCost: 150.25, currentPrice: 185.50, marketValue: 92750, unrealizedPnL: 17625, percentChange: 23.5 },
      { symbol: 'GOOGL', quantity: 200, avgCost: 125.00, currentPrice: 142.30, marketValue: 28460, unrealizedPnL: 3460, percentChange: 13.8 },
      { symbol: 'MSFT', quantity: 300, avgCost: 320.00, currentPrice: 378.25, marketValue: 113475, unrealizedPnL: 17475, percentChange: 18.2 },
      { symbol: 'AMZN', quantity: 150, avgCost: 145.50, currentPrice: 168.20, marketValue: 25230, unrealizedPnL: 3405, percentChange: 15.6 },
      { symbol: 'NVDA', quantity: 100, avgCost: 450.00, currentPrice: 520.80, marketValue: 52080, unrealizedPnL: 7080, percentChange: 15.7 },
    ] as Position[],
  });

  const [riskMetrics] = useState({
    var95: 45000,
    var99: 68000,
    sharpeRatio: 1.85,
    beta: 1.12,
    volatility: 0.18,
    maxDrawdown: 0.12,
  });

  const [fraudAlerts] = useState<FraudAlert[]>([
    {
      id: 'alert-1',
      transactionId: 'TXN-123456',
      timestamp: '2024-01-15T10:30:00Z',
      amount: 150000,
      riskScore: 0.85,
      indicators: ['High value transaction', 'Unusual time', 'New recipient'],
      status: 'pending',
    },
    {
      id: 'alert-2',
      transactionId: 'TXN-123457',
      timestamp: '2024-01-15T09:15:00Z',
      amount: 75000,
      riskScore: 0.72,
      indicators: ['International transfer', 'First-time country'],
      status: 'investigating',
    },
  ]);

  const [soxControls] = useState<SOXControl[]>([
    { id: 'sox-1', name: 'User Access Review', category: 'Access Controls', status: 'effective', lastTested: '2024-01-10' },
    { id: 'sox-2', name: 'Change Approval Process', category: 'Change Management', status: 'effective', lastTested: '2024-01-12' },
    { id: 'sox-3', name: 'Reconciliation Controls', category: 'Financial Reporting', status: 'deficient', lastTested: '2024-01-08' },
    { id: 'sox-4', name: 'Segregation of Duties', category: 'Operations', status: 'effective', lastTested: '2024-01-05' },
  ]);

  const [activeTab, setActiveTab] = useState('portfolio');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'effective':
        return <Badge className="bg-green-500/10 text-green-400 border-green-500/20">Effective</Badge>;
      case 'deficient':
        return <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">Deficient</Badge>;
      case 'material_weakness':
        return <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Material Weakness</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="p-6 space-y-6 bg-gray-950 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-green-400" />
            Finance Solution
          </h1>
          <p className="text-gray-400 mt-1">SOX-compliant trading analytics and fraud detection</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="border-green-500/50 text-green-400">
            <Shield className="h-3 w-3 mr-1" />
            SOX Compliant
          </Badge>
          <Badge variant="outline" className="border-blue-500/50 text-blue-400">
            <Lock className="h-3 w-3 mr-1" />
            Full Audit Trail
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-900/50 border border-gray-800">
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
          <TabsTrigger value="risk">Risk Analytics</TabsTrigger>
          <TabsTrigger value="fraud">Fraud Detection</TabsTrigger>
          <TabsTrigger value="sox">SOX Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="portfolio" className="mt-6">
          {/* Portfolio Summary */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="p-4">
                <p className="text-sm text-gray-400">Total Portfolio Value</p>
                <p className="text-2xl font-bold text-white">${portfolio.totalValue.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="p-4">
                <p className="text-sm text-gray-400">Cash Available</p>
                <p className="text-2xl font-bold text-white">${portfolio.cash.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="p-4">
                <p className="text-sm text-gray-400">Unrealized P&L</p>
                <p className={`text-2xl font-bold ${portfolio.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {portfolio.unrealizedPnL >= 0 ? '+' : ''}{portfolio.unrealizedPnL.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="p-4">
                <p className="text-sm text-gray-400">Realized P&L</p>
                <p className={`text-2xl font-bold ${portfolio.realizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {portfolio.realizedPnL >= 0 ? '+' : ''}{portfolio.realizedPnL.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Positions */}
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Positions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left p-2 text-gray-400 font-medium">Symbol</th>
                      <th className="text-right p-2 text-gray-400 font-medium">Quantity</th>
                      <th className="text-right p-2 text-gray-400 font-medium">Avg Cost</th>
                      <th className="text-right p-2 text-gray-400 font-medium">Current Price</th>
                      <th className="text-right p-2 text-gray-400 font-medium">Market Value</th>
                      <th className="text-right p-2 text-gray-400 font-medium">Unrealized P&L</th>
                      <th className="text-right p-2 text-gray-400 font-medium">% Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.positions.map(pos => (
                      <tr key={pos.symbol} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="p-2 font-medium text-white">{pos.symbol}</td>
                        <td className="p-2 text-right text-gray-300">{pos.quantity}</td>
                        <td className="p-2 text-right text-gray-300">${pos.avgCost.toFixed(2)}</td>
                        <td className="p-2 text-right text-gray-300">${pos.currentPrice.toFixed(2)}</td>
                        <td className="p-2 text-right text-white">${pos.marketValue.toLocaleString()}</td>
                        <td className={`p-2 text-right ${pos.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {pos.unrealizedPnL >= 0 ? '+' : ''}${pos.unrealizedPnL.toLocaleString()}
                        </td>
                        <td className="p-2 text-right">
                          <span className={`flex items-center justify-end gap-1 ${pos.percentChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {pos.percentChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                            {pos.percentChange.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="mt-6">
          <div className="grid grid-cols-3 gap-6">
            {/* Risk Metrics */}
            <Card className="bg-gray-900/50 border-gray-800 col-span-2">
              <CardHeader>
                <CardTitle className="text-white">Risk Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-800/50 rounded-lg">
                    <p className="text-sm text-gray-400">VaR (95%)</p>
                    <p className="text-xl font-bold text-red-400">${riskMetrics.var95.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">Daily value at risk</p>
                  </div>
                  <div className="p-4 bg-gray-800/50 rounded-lg">
                    <p className="text-sm text-gray-400">VaR (99%)</p>
                    <p className="text-xl font-bold text-red-400">${riskMetrics.var99.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">Extreme scenario</p>
                  </div>
                  <div className="p-4 bg-gray-800/50 rounded-lg">
                    <p className="text-sm text-gray-400">Sharpe Ratio</p>
                    <p className="text-xl font-bold text-green-400">{riskMetrics.sharpeRatio.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">Risk-adjusted return</p>
                  </div>
                  <div className="p-4 bg-gray-800/50 rounded-lg">
                    <p className="text-sm text-gray-400">Beta</p>
                    <p className="text-xl font-bold text-blue-400">{riskMetrics.beta.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">Market correlation</p>
                  </div>
                  <div className="p-4 bg-gray-800/50 rounded-lg">
                    <p className="text-sm text-gray-400">Volatility</p>
                    <p className="text-xl font-bold text-yellow-400">{(riskMetrics.volatility * 100).toFixed(1)}%</p>
                    <p className="text-xs text-gray-500">Annualized</p>
                  </div>
                  <div className="p-4 bg-gray-800/50 rounded-lg">
                    <p className="text-sm text-gray-400">Max Drawdown</p>
                    <p className="text-xl font-bold text-red-400">-{(riskMetrics.maxDrawdown * 100).toFixed(1)}%</p>
                    <p className="text-xs text-gray-500">Peak to trough</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Exposure */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Sector Exposure</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { sector: 'Technology', percent: 45, color: 'bg-blue-500' },
                    { sector: 'Healthcare', percent: 20, color: 'bg-green-500' },
                    { sector: 'Financials', percent: 15, color: 'bg-yellow-500' },
                    { sector: 'Consumer', percent: 12, color: 'bg-purple-500' },
                    { sector: 'Other', percent: 8, color: 'bg-gray-500' },
                  ].map(item => (
                    <div key={item.sector}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-gray-400">{item.sector}</span>
                        <span className="text-sm text-white">{item.percent}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${item.percent}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fraud" className="mt-6">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
                Fraud Alerts
              </CardTitle>
              <CardDescription>AI-powered transaction monitoring</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {fraudAlerts.map(alert => (
                <div key={alert.id} className={`p-4 rounded-lg border ${
                  alert.status === 'pending' ? 'bg-red-500/10 border-red-500/30' :
                  alert.status === 'investigating' ? 'bg-yellow-500/10 border-yellow-500/30' :
                  'bg-gray-800/50 border-gray-700'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-white font-medium">Transaction {alert.transactionId}</p>
                      <p className="text-sm text-gray-400">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-white">${alert.amount.toLocaleString()}</p>
                      <Badge className={
                        alert.riskScore > 0.8 ? 'bg-red-500/10 text-red-400' :
                        alert.riskScore > 0.6 ? 'bg-yellow-500/10 text-yellow-400' :
                        'bg-green-500/10 text-green-400'
                      }>
                        Risk: {(alert.riskScore * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {alert.indicators.map((ind, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {ind}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="border-green-500/50 text-green-400">
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" className="border-red-500/50 text-red-400">
                      <XCircle className="h-4 w-4 mr-1" />
                      Block
                    </Button>
                    <Button size="sm" variant="outline">
                      <Eye className="h-4 w-4 mr-1" />
                      Investigate
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sox" className="mt-6">
          <div className="grid grid-cols-2 gap-6">
            {/* SOX Controls Status */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">SOX Control Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {soxControls.map(control => (
                  <div key={control.id} className="p-3 bg-gray-800/50 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">{control.name}</p>
                      <p className="text-sm text-gray-400">{control.category}</p>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(control.status)}
                      <p className="text-xs text-gray-500 mt-1">
                        Last tested: {control.lastTested}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Compliance Summary */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Compliance Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
                    <p className="text-3xl font-bold text-green-400">
                      {soxControls.filter(c => c.status === 'effective').length}
                    </p>
                    <p className="text-sm text-gray-400">Effective Controls</p>
                  </div>
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-center">
                    <p className="text-3xl font-bold text-yellow-400">
                      {soxControls.filter(c => c.status === 'deficient').length}
                    </p>
                    <p className="text-sm text-gray-400">Deficient Controls</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <Button className="w-full">
                    <FileText className="h-4 w-4 mr-2" />
                    Generate SOX Report
                  </Button>
                  <Button variant="outline" className="w-full">
                    <Clock className="h-4 w-4 mr-2" />
                    Schedule Control Testing
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
