'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Factory,
  Gauge,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Thermometer,
  Zap,
  Timer,
  TrendingUp,
  Settings,
  BarChart3,
  Play,
  Pause,
} from 'lucide-react';

interface Equipment {
  id: string;
  name: string;
  type: string;
  status: 'running' | 'idle' | 'maintenance' | 'fault';
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  temperature: number;
  vibration: number;
}

interface MaintenanceAlert {
  id: string;
  equipmentId: string;
  equipmentName: string;
  type: 'predictive' | 'preventive' | 'corrective';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  daysToFailure: number;
  recommendedAction: string;
}

interface ProductionOrder {
  id: string;
  productName: string;
  quantity: number;
  completed: number;
  defects: number;
  status: 'in_progress' | 'completed' | 'on_hold';
  priority: 'normal' | 'high' | 'urgent';
}

export default function ManufacturingDashboard() {
  const [equipment, setEquipment] = useState<Equipment[]>([
    { id: 'eq-1', name: 'CNC Machine 01', type: 'cnc', status: 'running', oee: 0.85, availability: 0.92, performance: 0.95, quality: 0.97, temperature: 65, vibration: 1.2 },
    { id: 'eq-2', name: 'Hydraulic Press 01', type: 'press', status: 'running', oee: 0.78, availability: 0.88, performance: 0.92, quality: 0.96, temperature: 72, vibration: 1.8 },
    { id: 'eq-3', name: 'Assembly Robot 01', type: 'robot', status: 'maintenance', oee: 0, availability: 0, performance: 0, quality: 0, temperature: 45, vibration: 0.3 },
    { id: 'eq-4', name: 'Conveyor Line 01', type: 'conveyor', status: 'running', oee: 0.91, availability: 0.98, performance: 0.95, quality: 0.98, temperature: 38, vibration: 0.8 },
  ]);

  const [maintenanceAlerts] = useState<MaintenanceAlert[]>([
    { id: 'alert-1', equipmentId: 'eq-2', equipmentName: 'Hydraulic Press 01', type: 'predictive', riskLevel: 'high', component: 'Bearings', daysToFailure: 12, recommendedAction: 'Schedule bearing replacement' },
    { id: 'alert-2', equipmentId: 'eq-1', equipmentName: 'CNC Machine 01', type: 'preventive', riskLevel: 'medium', component: 'Coolant System', daysToFailure: 30, recommendedAction: 'Check coolant levels' },
  ]);

  const [productionOrders] = useState<ProductionOrder[]>([
    { id: 'po-1', productName: 'Widget A', quantity: 1000, completed: 750, defects: 12, status: 'in_progress', priority: 'urgent' },
    { id: 'po-2', productName: 'Component B', quantity: 500, completed: 500, defects: 5, status: 'completed', priority: 'normal' },
    { id: 'po-3', productName: 'Assembly C', quantity: 200, completed: 45, defects: 2, status: 'in_progress', priority: 'high' },
  ]);

  const [activeTab, setActiveTab] = useState('overview');

  const plantOEE = equipment.filter(e => e.status === 'running').reduce((sum, e) => sum + e.oee, 0) / equipment.filter(e => e.status === 'running').length || 0;

  useEffect(() => {
    // Simulate real-time updates
    const interval = setInterval(() => {
      setEquipment(prev => prev.map(eq => {
        if (eq.status !== 'running') return eq;
        return {
          ...eq,
          temperature: eq.temperature + (Math.random() - 0.5) * 2,
          vibration: Math.max(0.1, eq.vibration + (Math.random() - 0.5) * 0.2),
          oee: Math.max(0.5, Math.min(1, eq.oee + (Math.random() - 0.5) * 0.02)),
        };
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: Equipment['status']) => {
    switch (status) {
      case 'running': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'idle': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'maintenance': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'fault': return 'bg-red-500/10 text-red-400 border-red-500/20';
    }
  };

  const getRiskColor = (risk: MaintenanceAlert['riskLevel']) => {
    switch (risk) {
      case 'low': return 'bg-green-500/10 text-green-400';
      case 'medium': return 'bg-yellow-500/10 text-yellow-400';
      case 'high': return 'bg-orange-500/10 text-orange-400';
      case 'critical': return 'bg-red-500/10 text-red-400';
    }
  };

  return (
    <div className="p-6 space-y-6 bg-gray-950 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Factory className="h-8 w-8 text-orange-400" />
            Manufacturing Solution
          </h1>
          <p className="text-gray-400 mt-1">OEE monitoring and predictive maintenance</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="border-orange-500/50 text-orange-400">
            <Activity className="h-3 w-3 mr-1" />
            Live Monitoring
          </Badge>
          <Badge variant="outline" className="border-green-500/50 text-green-400">
            <Gauge className="h-3 w-3 mr-1" />
            Plant OEE: {(plantOEE * 100).toFixed(1)}%
          </Badge>
        </div>
      </div>

      {/* Plant Overview Stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4 text-center">
            <Gauge className="h-8 w-8 text-green-400 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Plant OEE</p>
            <p className="text-2xl font-bold text-white">{(plantOEE * 100).toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4 text-center">
            <Play className="h-8 w-8 text-blue-400 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Running</p>
            <p className="text-2xl font-bold text-white">{equipment.filter(e => e.status === 'running').length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4 text-center">
            <Wrench className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Maintenance</p>
            <p className="text-2xl font-bold text-white">{equipment.filter(e => e.status === 'maintenance').length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Alerts</p>
            <p className="text-2xl font-bold text-white">{maintenanceAlerts.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Quality Rate</p>
            <p className="text-2xl font-bold text-white">97.2%</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-900/50 border border-gray-800">
          <TabsTrigger value="overview">Equipment Overview</TabsTrigger>
          <TabsTrigger value="oee">OEE Analytics</TabsTrigger>
          <TabsTrigger value="maintenance">Predictive Maintenance</TabsTrigger>
          <TabsTrigger value="production">Production Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-2 gap-4">
            {equipment.map(eq => (
              <Card key={eq.id} className="bg-gray-900/50 border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-orange-500/10">
                        <Factory className="h-5 w-5 text-orange-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{eq.name}</h3>
                        <p className="text-sm text-gray-400 capitalize">{eq.type}</p>
                      </div>
                    </div>
                    <Badge className={getStatusColor(eq.status)}>
                      {eq.status}
                    </Badge>
                  </div>

                  {eq.status === 'running' && (
                    <>
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="text-center">
                          <p className="text-sm text-gray-400">OEE</p>
                          <p className="text-xl font-bold text-green-400">{(eq.oee * 100).toFixed(1)}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-400">Availability</p>
                          <p className="text-xl font-bold text-blue-400">{(eq.availability * 100).toFixed(1)}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-400">Quality</p>
                          <p className="text-xl font-bold text-purple-400">{(eq.quality * 100).toFixed(1)}%</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 p-3 bg-gray-800/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Thermometer className={`h-4 w-4 ${eq.temperature > 70 ? 'text-red-400' : 'text-blue-400'}`} />
                          <span className="text-sm text-gray-400">Temp:</span>
                          <span className="text-white">{eq.temperature.toFixed(1)}°C</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Activity className={`h-4 w-4 ${eq.vibration > 1.5 ? 'text-yellow-400' : 'text-green-400'}`} />
                          <span className="text-sm text-gray-400">Vibration:</span>
                          <span className="text-white">{eq.vibration.toFixed(2)} mm/s</span>
                        </div>
                      </div>
                    </>
                  )}

                  {eq.status === 'maintenance' && (
                    <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-center">
                      <Wrench className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                      <p className="text-blue-400">Under scheduled maintenance</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="oee" className="mt-6">
          <div className="grid grid-cols-3 gap-6">
            <Card className="bg-gray-900/50 border-gray-800 col-span-2">
              <CardHeader>
                <CardTitle className="text-white">OEE Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {equipment.filter(e => e.status === 'running').map(eq => (
                    <div key={eq.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium">{eq.name}</span>
                        <span className="text-green-400 font-bold">{(eq.oee * 100).toFixed(1)}% OEE</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>Availability</span>
                            <span>{(eq.availability * 100).toFixed(0)}%</span>
                          </div>
                          <Progress value={eq.availability * 100} className="h-2" />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>Performance</span>
                            <span>{(eq.performance * 100).toFixed(0)}%</span>
                          </div>
                          <Progress value={eq.performance * 100} className="h-2" />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>Quality</span>
                            <span>{(eq.quality * 100).toFixed(0)}%</span>
                          </div>
                          <Progress value={eq.quality * 100} className="h-2" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">World-Class Benchmark</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-4 bg-gray-800/50 rounded-lg">
                  <p className="text-sm text-gray-400">Current Plant OEE</p>
                  <p className="text-4xl font-bold text-white">{(plantOEE * 100).toFixed(1)}%</p>
                </div>
                <div className="text-center p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <p className="text-sm text-gray-400">World-Class Target</p>
                  <p className="text-4xl font-bold text-green-400">85%</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-400">Gap to World-Class</p>
                  <p className={`text-2xl font-bold ${plantOEE >= 0.85 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {plantOEE >= 0.85 ? '+' : ''}{((plantOEE - 0.85) * 100).toFixed(1)}%
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="maintenance" className="mt-6">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
                Predictive Maintenance Alerts
              </CardTitle>
              <CardDescription>AI-powered failure prediction</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {maintenanceAlerts.map(alert => (
                <div key={alert.id} className={`p-4 rounded-lg border ${
                  alert.riskLevel === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                  alert.riskLevel === 'high' ? 'bg-orange-500/10 border-orange-500/30' :
                  'bg-yellow-500/10 border-yellow-500/30'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-white font-medium">{alert.equipmentName}</p>
                      <p className="text-sm text-gray-400">Component: {alert.component}</p>
                    </div>
                    <div className="text-right">
                      <Badge className={getRiskColor(alert.riskLevel)}>
                        {alert.riskLevel.toUpperCase()} RISK
                      </Badge>
                      <p className="text-sm text-gray-400 mt-1">
                        <Timer className="h-3 w-3 inline mr-1" />
                        {alert.daysToFailure} days to failure
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-gray-300 mb-3">
                    <strong>Recommended Action:</strong> {alert.recommendedAction}
                  </p>

                  <div className="flex gap-2">
                    <Button size="sm">
                      <Wrench className="h-4 w-4 mr-1" />
                      Schedule Maintenance
                    </Button>
                    <Button size="sm" variant="outline">
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="production" className="mt-6">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Production Orders</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {productionOrders.map(order => (
                <div key={order.id} className="p-4 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-white font-medium">{order.productName}</h4>
                      <p className="text-sm text-gray-400">Order: {order.id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={
                        order.priority === 'urgent' ? 'bg-red-500/10 text-red-400' :
                        order.priority === 'high' ? 'bg-orange-500/10 text-orange-400' :
                        'bg-gray-500/10 text-gray-400'
                      }>
                        {order.priority}
                      </Badge>
                      <Badge className={
                        order.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                        order.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400' :
                        'bg-yellow-500/10 text-yellow-400'
                      }>
                        {order.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Progress</span>
                      <span className="text-white">{order.completed} / {order.quantity} units</span>
                    </div>
                    <Progress value={(order.completed / order.quantity) * 100} className="h-2" />
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">
                      Defect Rate: <span className="text-yellow-400">{((order.defects / order.completed) * 100).toFixed(2)}%</span>
                    </span>
                    <span className="text-gray-400">
                      First Pass Yield: <span className="text-green-400">{(((order.completed - order.defects) / order.completed) * 100).toFixed(1)}%</span>
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
