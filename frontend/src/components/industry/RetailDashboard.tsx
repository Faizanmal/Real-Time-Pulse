'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ShoppingCart,
  Package,
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Target,
  AlertTriangle,
  Search,
  Star,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  inventory: number;
  reorderPoint: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
}

interface CustomerSegment {
  name: string;
  count: number;
  avgLTV: number;
  avgOrderValue: number;
  churnRisk: number;
  color: string;
}

interface SalesMetric {
  label: string;
  value: number;
  change: number;
  format: 'currency' | 'number' | 'percent';
}

export default function RetailDashboard() {
  const [products] = useState<Product[]>([
    { id: 'prod-1', sku: 'SHIRT-001', name: 'Classic White Shirt', category: 'Apparel', price: 59.99, inventory: 45, reorderPoint: 20, status: 'in_stock' },
    { id: 'prod-2', sku: 'JEANS-002', name: 'Slim Fit Jeans', category: 'Apparel', price: 89.99, inventory: 12, reorderPoint: 15, status: 'low_stock' },
    { id: 'prod-3', sku: 'SHOES-003', name: 'Running Sneakers', category: 'Footwear', price: 129.99, inventory: 0, reorderPoint: 10, status: 'out_of_stock' },
    { id: 'prod-4', sku: 'BAG-004', name: 'Leather Tote', category: 'Accessories', price: 149.99, inventory: 28, reorderPoint: 8, status: 'in_stock' },
    { id: 'prod-5', sku: 'WATCH-005', name: 'Digital Watch', category: 'Accessories', price: 199.99, inventory: 5, reorderPoint: 10, status: 'low_stock' },
  ]);

  const [customerSegments] = useState<CustomerSegment[]>([
    { name: 'VIP', count: 1250, avgLTV: 5420, avgOrderValue: 185, churnRisk: 0.05, color: 'text-purple-400' },
    { name: 'Loyal', count: 4820, avgLTV: 2150, avgOrderValue: 125, churnRisk: 0.12, color: 'text-blue-400' },
    { name: 'Regular', count: 12450, avgLTV: 850, avgOrderValue: 85, churnRisk: 0.25, color: 'text-green-400' },
    { name: 'New', count: 3200, avgLTV: 150, avgOrderValue: 65, churnRisk: 0.35, color: 'text-cyan-400' },
    { name: 'At Risk', count: 2100, avgLTV: 420, avgOrderValue: 72, churnRisk: 0.65, color: 'text-yellow-400' },
    { name: 'Churned', count: 5800, avgLTV: 280, avgOrderValue: 55, churnRisk: 0.95, color: 'text-red-400' },
  ]);

  const [salesMetrics] = useState<SalesMetric[]>([
    { label: 'Today\'s Revenue', value: 45280, change: 12.5, format: 'currency' },
    { label: 'Transactions', value: 342, change: 8.2, format: 'number' },
    { label: 'Avg Basket Size', value: 132.40, change: -2.1, format: 'currency' },
    { label: 'Conversion Rate', value: 3.8, change: 0.5, format: 'percent' },
  ]);

  const [pricingRecommendations] = useState([
    { productId: 'prod-1', name: 'Classic White Shirt', currentPrice: 59.99, recommendedPrice: 64.99, expectedRevenue: 8.5, elasticity: -1.2 },
    { productId: 'prod-4', name: 'Leather Tote', currentPrice: 149.99, recommendedPrice: 139.99, expectedRevenue: 15.2, elasticity: -1.8 },
  ]);

  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');

  const getStatusBadge = (status: Product['status']) => {
    switch (status) {
      case 'in_stock':
        return <Badge className="bg-green-500/10 text-green-400 border-green-500/20">In Stock</Badge>;
      case 'low_stock':
        return <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">Low Stock</Badge>;
      case 'out_of_stock':
        return <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Out of Stock</Badge>;
    }
  };

  const formatValue = (value: number, format: string) => {
    switch (format) {
      case 'currency':
        return `$${value.toLocaleString()}`;
      case 'percent':
        return `${value}%`;
      default:
        return value.toLocaleString();
    }
  };

  return (
    <div className="p-6 space-y-6 bg-gray-950 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ShoppingCart className="h-8 w-8 text-pink-400" />
            Retail Solution
          </h1>
          <p className="text-gray-400 mt-1">Inventory optimization and customer analytics</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="border-pink-500/50 text-pink-400">
            <Package className="h-3 w-3 mr-1" />
            {products.filter(p => p.status !== 'out_of_stock').length} Products Active
          </Badge>
          <Badge variant="outline" className="border-purple-500/50 text-purple-400">
            <Users className="h-3 w-3 mr-1" />
            {customerSegments.reduce((sum, s) => sum + s.count, 0).toLocaleString()} Customers
          </Badge>
        </div>
      </div>

      {/* Sales Metrics */}
      <div className="grid grid-cols-4 gap-4">
        {salesMetrics.map(metric => (
          <Card key={metric.label} className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-4">
              <p className="text-sm text-gray-400">{metric.label}</p>
              <div className="flex items-end justify-between mt-2">
                <p className="text-2xl font-bold text-white">
                  {formatValue(metric.value, metric.format)}
                </p>
                <span className={`flex items-center text-sm ${metric.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {metric.change >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  {Math.abs(metric.change)}%
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-900/50 border border-gray-800">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="customers">Customer Analytics</TabsTrigger>
          <TabsTrigger value="pricing">Pricing Optimization</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Channel Performance */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Sales by Channel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { channel: 'Online Store', revenue: 125000, percent: 45 },
                  { channel: 'Physical Stores', revenue: 95000, percent: 35 },
                  { channel: 'Mobile App', revenue: 42000, percent: 15 },
                  { channel: 'Marketplace', revenue: 15000, percent: 5 },
                ].map(item => (
                  <div key={item.channel}>
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-400">{item.channel}</span>
                      <span className="text-white">${item.revenue.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div className="bg-pink-500 h-2 rounded-full" style={{ width: `${item.percent}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Top Products */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Top Selling Products</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { name: 'Running Sneakers', revenue: 15600, units: 120 },
                  { name: 'Classic White Shirt', revenue: 12500, units: 208 },
                  { name: 'Leather Tote', revenue: 10500, units: 70 },
                  { name: 'Digital Watch', revenue: 8000, units: 40 },
                ].map((product, i) => (
                  <div key={product.name} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-500">#{i + 1}</span>
                      <div>
                        <p className="text-white font-medium">{product.name}</p>
                        <p className="text-sm text-gray-400">{product.units} units sold</p>
                      </div>
                    </div>
                    <p className="text-green-400 font-bold">${product.revenue.toLocaleString()}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="inventory" className="mt-6">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Inventory Management</CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 w-64 bg-gray-800 border-gray-700"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left p-3 text-gray-400 font-medium">SKU</th>
                      <th className="text-left p-3 text-gray-400 font-medium">Product</th>
                      <th className="text-left p-3 text-gray-400 font-medium">Category</th>
                      <th className="text-right p-3 text-gray-400 font-medium">Price</th>
                      <th className="text-right p-3 text-gray-400 font-medium">Stock</th>
                      <th className="text-center p-3 text-gray-400 font-medium">Status</th>
                      <th className="text-center p-3 text-gray-400 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products
                      .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map(product => (
                        <tr key={product.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="p-3 text-gray-400 font-mono text-sm">{product.sku}</td>
                          <td className="p-3 text-white font-medium">{product.name}</td>
                          <td className="p-3 text-gray-400">{product.category}</td>
                          <td className="p-3 text-right text-white">${product.price.toFixed(2)}</td>
                          <td className="p-3 text-right">
                            <span className={product.inventory <= product.reorderPoint ? 'text-yellow-400' : 'text-white'}>
                              {product.inventory}
                            </span>
                            <span className="text-gray-500"> / {product.reorderPoint}</span>
                          </td>
                          <td className="p-3 text-center">{getStatusBadge(product.status)}</td>
                          <td className="p-3 text-center">
                            <Button size="sm" variant="outline">
                              Reorder
                            </Button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Low Stock Alerts */}
              <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                  <span className="text-yellow-400 font-medium">Low Stock Alerts</span>
                </div>
                <div className="flex gap-4">
                  {products.filter(p => p.status !== 'in_stock').map(p => (
                    <Badge key={p.id} variant="outline" className="border-yellow-500/50 text-yellow-400">
                      {p.name}: {p.inventory} remaining
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="mt-6">
          <div className="grid grid-cols-3 gap-6">
            {/* Customer Segments */}
            <Card className="bg-gray-900/50 border-gray-800 col-span-2">
              <CardHeader>
                <CardTitle className="text-white">Customer Segmentation</CardTitle>
                <CardDescription>RFM-based customer segments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {customerSegments.map(segment => (
                    <div key={segment.name} className="p-4 bg-gray-800/50 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-lg font-bold ${segment.color}`}>{segment.name}</span>
                        <Badge variant="outline">{segment.count.toLocaleString()}</Badge>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Avg LTV</span>
                          <span className="text-white">${segment.avgLTV.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Avg Order</span>
                          <span className="text-white">${segment.avgOrderValue}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Churn Risk</span>
                          <span className={segment.churnRisk > 0.5 ? 'text-red-400' : segment.churnRisk > 0.2 ? 'text-yellow-400' : 'text-green-400'}>
                            {(segment.churnRisk * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recommendations */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">AI Recommendations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <p className="text-sm text-purple-300 font-medium">VIP Segment</p>
                  <p className="text-xs text-gray-400 mt-1">Send exclusive early access invites for new collection</p>
                </div>
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-sm text-yellow-300 font-medium">At Risk Segment</p>
                  <p className="text-xs text-gray-400 mt-1">Send win-back campaign with 20% discount code</p>
                </div>
                <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                  <p className="text-sm text-cyan-300 font-medium">New Customers</p>
                  <p className="text-xs text-gray-400 mt-1">Start loyalty program onboarding sequence</p>
                </div>
                <Button className="w-full mt-4">
                  <Target className="h-4 w-4 mr-2" />
                  Launch Campaign
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pricing" className="mt-6">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Percent className="h-5 w-5 text-green-400" />
                AI Pricing Recommendations
              </CardTitle>
              <CardDescription>Optimize prices based on elasticity and competitor analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pricingRecommendations.map(rec => (
                <div key={rec.productId} className="p-4 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-white font-medium">{rec.name}</h4>
                      <p className="text-sm text-gray-400">Price Elasticity: {rec.elasticity.toFixed(2)}</p>
                    </div>
                    <Badge className={rec.expectedRevenue > 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}>
                      Expected Revenue: {rec.expectedRevenue > 0 ? '+' : ''}{rec.expectedRevenue}%
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-1 p-3 bg-gray-700/50 rounded-lg text-center">
                      <p className="text-sm text-gray-400">Current Price</p>
                      <p className="text-xl font-bold text-white">${rec.currentPrice}</p>
                    </div>
                    <div className="text-2xl text-gray-500">→</div>
                    <div className={`flex-1 p-3 rounded-lg text-center ${rec.recommendedPrice > rec.currentPrice ? 'bg-green-500/10' : 'bg-blue-500/10'}`}>
                      <p className="text-sm text-gray-400">Recommended Price</p>
                      <p className={`text-xl font-bold ${rec.recommendedPrice > rec.currentPrice ? 'text-green-400' : 'text-blue-400'}`}>
                        ${rec.recommendedPrice}
                      </p>
                    </div>
                    <Button>Apply</Button>
                  </div>
                </div>
              ))}

              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <h4 className="text-blue-300 font-medium mb-2">Competitor Monitoring</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Competitor A</p>
                    <p className="text-white">Similar products avg: $65.99</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Competitor B</p>
                    <p className="text-white">Similar products avg: $58.50</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Market Average</p>
                    <p className="text-white">$62.25</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
