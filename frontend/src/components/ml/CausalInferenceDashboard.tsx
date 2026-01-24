'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  GitBranch,
  Target,
  FlaskConical,
  ArrowRight,
  Plus,
  Play,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Network,
} from 'lucide-react';

interface CausalVariable {
  name: string;
  type: 'treatment' | 'outcome' | 'confounder' | 'mediator' | 'instrument';
  dataType: 'continuous' | 'binary' | 'categorical';
}

interface CausalEdge {
  from: string;
  to: string;
  type: 'causal' | 'confounding' | 'mediation';
}

interface CausalGraph {
  id: string;
  name: string;
  variables: CausalVariable[];
  edges: CausalEdge[];
}

interface CausalEffect {
  treatment: string;
  outcome: string;
  estimate: number;
  confidenceInterval: [number, number];
  pValue: number;
  isSignificant: boolean;
}

interface ABTest {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'significant' | 'inconclusive';
  metric: string;
  sampleSize: { treatment: number; control: number };
  effect: number;
  pValue: number;
  power: number;
}

const variableTypes = [
  { value: 'treatment', label: 'Treatment', color: 'text-blue-400', description: 'Variable we manipulate' },
  { value: 'outcome', label: 'Outcome', color: 'text-green-400', description: 'Variable we measure' },
  { value: 'confounder', label: 'Confounder', color: 'text-yellow-400', description: 'Affects both treatment & outcome' },
  { value: 'mediator', label: 'Mediator', color: 'text-purple-400', description: 'Lies on causal path' },
  { value: 'instrument', label: 'Instrument', color: 'text-cyan-400', description: 'Affects only treatment' },
];

export default function CausalInferenceDashboard() {
  const [graphs, setGraphs] = useState<CausalGraph[]>([
    {
      id: 'graph-1',
      name: 'Marketing Campaign Effect',
      variables: [
        { name: 'campaign_exposure', type: 'treatment', dataType: 'binary' },
        { name: 'purchase', type: 'outcome', dataType: 'binary' },
        { name: 'income', type: 'confounder', dataType: 'continuous' },
        { name: 'age', type: 'confounder', dataType: 'continuous' },
        { name: 'brand_awareness', type: 'mediator', dataType: 'continuous' },
      ],
      edges: [
        { from: 'campaign_exposure', to: 'brand_awareness', type: 'causal' },
        { from: 'brand_awareness', to: 'purchase', type: 'causal' },
        { from: 'income', to: 'campaign_exposure', type: 'confounding' },
        { from: 'income', to: 'purchase', type: 'confounding' },
        { from: 'age', to: 'campaign_exposure', type: 'confounding' },
        { from: 'age', to: 'purchase', type: 'confounding' },
      ],
    },
  ]);

  const [abTests] = useState<ABTest[]>([
    {
      id: 'test-1',
      name: 'New Checkout Flow',
      status: 'significant',
      metric: 'conversion_rate',
      sampleSize: { treatment: 15420, control: 15380 },
      effect: 0.023,
      pValue: 0.0021,
      power: 0.92,
    },
    {
      id: 'test-2',
      name: 'Pricing Strategy A',
      status: 'running',
      metric: 'revenue_per_user',
      sampleSize: { treatment: 8240, control: 8180 },
      effect: 0.15,
      pValue: 0.072,
      power: 0.68,
    },
    {
      id: 'test-3',
      name: 'Email Subject Lines',
      status: 'inconclusive',
      metric: 'open_rate',
      sampleSize: { treatment: 5000, control: 5000 },
      effect: 0.002,
      pValue: 0.45,
      power: 0.12,
    },
  ]);

  const [selectedGraph, setSelectedGraph] = useState<CausalGraph | null>(graphs[0]);
  const [causalEffects, setCausalEffects] = useState<CausalEffect[]>([]);
  const [activeTab, setActiveTab] = useState('graphs');

  const [newVariable, setNewVariable] = useState<CausalVariable>({
    name: '',
    type: 'treatment',
    dataType: 'continuous',
  });

  const handleAddVariable = () => {
    if (!selectedGraph || !newVariable.name) return;
    
    const updated = {
      ...selectedGraph,
      variables: [...selectedGraph.variables, newVariable],
    };
    
    setGraphs(prev => prev.map(g => g.id === selectedGraph.id ? updated : g));
    setSelectedGraph(updated);
    setNewVariable({ name: '', type: 'treatment', dataType: 'continuous' });
  };

  const handleRunCausalAnalysis = () => {
    if (!selectedGraph) return;

    const treatment = selectedGraph.variables.find(v => v.type === 'treatment');
    const outcome = selectedGraph.variables.find(v => v.type === 'outcome');

    if (!treatment || !outcome) return;

    // Simulate causal effect estimation
    const effect = 0.1 + Math.random() * 0.3;
    const se = effect * 0.2;
    const pValue = Math.exp(-Math.abs(effect / se));

    const result: CausalEffect = {
      treatment: treatment.name,
      outcome: outcome.name,
      estimate: effect,
      confidenceInterval: [effect - 1.96 * se, effect + 1.96 * se],
      pValue,
      isSignificant: pValue < 0.05,
    };

    setCausalEffects(prev => [result, ...prev]);
  };

  const getStatusBadge = (status: ABTest['status']) => {
    switch (status) {
      case 'significant':
        return <Badge className="bg-green-500/10 text-green-400 border-green-500/20">Significant</Badge>;
      case 'running':
        return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">Running</Badge>;
      case 'inconclusive':
        return <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">Inconclusive</Badge>;
      case 'completed':
        return <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/20">Completed</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6 bg-gray-950 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <GitBranch className="h-8 w-8 text-cyan-400" />
            Causal Inference
          </h1>
          <p className="text-gray-400 mt-1">Analyze cause-and-effect relationships in your data</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="border-cyan-500/50 text-cyan-400">
            <Network className="h-3 w-3 mr-1" />
            {graphs.length} Graphs
          </Badge>
          <Badge variant="outline" className="border-green-500/50 text-green-400">
            <FlaskConical className="h-3 w-3 mr-1" />
            {abTests.filter(t => t.status === 'running').length} Active Tests
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-900/50 border border-gray-800">
          <TabsTrigger value="graphs">Causal Graphs</TabsTrigger>
          <TabsTrigger value="effects">Effect Estimation</TabsTrigger>
          <TabsTrigger value="abtests">A/B Testing</TabsTrigger>
          <TabsTrigger value="counterfactual">Counterfactual</TabsTrigger>
        </TabsList>

        <TabsContent value="graphs" className="mt-6">
          <div className="grid grid-cols-3 gap-6">
            {/* Graph List */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white text-lg">Causal Graphs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {graphs.map(graph => (
                  <button
                    key={graph.id}
                    onClick={() => setSelectedGraph(graph)}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      selectedGraph?.id === graph.id
                        ? 'bg-cyan-500/10 border border-cyan-500/50'
                        : 'bg-gray-800/50 border border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <p className="font-medium text-white">{graph.name}</p>
                    <p className="text-sm text-gray-400">
                      {graph.variables.length} variables, {graph.edges.length} edges
                    </p>
                  </button>
                ))}
                <Button variant="outline" className="w-full mt-2">
                  <Plus className="h-4 w-4 mr-2" />
                  New Graph
                </Button>
              </CardContent>
            </Card>

            {/* Graph Visualization */}
            <Card className="bg-gray-900/50 border-gray-800 col-span-2">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <span>{selectedGraph?.name || 'Select a Graph'}</span>
                  {selectedGraph && (
                    <Button size="sm" onClick={handleRunCausalAnalysis}>
                      <Play className="h-4 w-4 mr-2" />
                      Analyze
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedGraph ? (
                  <div className="space-y-6">
                    {/* Simple Graph Visualization */}
                    <div className="h-64 bg-gray-800/30 rounded-lg border border-gray-700 p-4 flex items-center justify-center">
                      <div className="flex items-center gap-8">
                        {selectedGraph.variables.map((v) => (
                          <div key={v.name} className="flex flex-col items-center">
                            <div className={`w-20 h-20 rounded-full border-2 flex items-center justify-center ${
                              v.type === 'treatment' ? 'border-blue-500 bg-blue-500/10' :
                              v.type === 'outcome' ? 'border-green-500 bg-green-500/10' :
                              v.type === 'confounder' ? 'border-yellow-500 bg-yellow-500/10' :
                              v.type === 'mediator' ? 'border-purple-500 bg-purple-500/10' :
                              'border-cyan-500 bg-cyan-500/10'
                            }`}>
                              <span className="text-xs text-center text-white px-2">{v.name}</span>
                            </div>
                            <Badge className="mt-2 text-xs" variant="outline">
                              {v.type}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Variables List */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-3">Variables</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedGraph.variables.map(v => (
                          <div key={v.name} className="flex items-center justify-between p-2 bg-gray-800/50 rounded">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${
                                v.type === 'treatment' ? 'bg-blue-400' :
                                v.type === 'outcome' ? 'bg-green-400' :
                                v.type === 'confounder' ? 'bg-yellow-400' :
                                v.type === 'mediator' ? 'bg-purple-400' :
                                'bg-cyan-400'
                              }`} />
                              <span className="text-white">{v.name}</span>
                            </div>
                            <span className="text-xs text-gray-500">{v.dataType}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Add Variable */}
                    <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
                      <h4 className="text-sm font-medium text-gray-400 mb-3">Add Variable</h4>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Variable name"
                          value={newVariable.name}
                          onChange={e => setNewVariable(prev => ({ ...prev, name: e.target.value }))}
                          className="bg-gray-800 border-gray-700"
                        />
                        <Select
                          value={newVariable.type}
                          onValueChange={v => setNewVariable(prev => ({ ...prev, type: v as 'treatment' | 'outcome' | 'confounder' | 'mediator' | 'instrument' }))}
                        >
                          <SelectTrigger className="w-40 bg-gray-800 border-gray-700">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {variableTypes.map(t => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button onClick={handleAddVariable}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    Select a graph to view and edit
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="effects" className="mt-6">
          <div className="grid gap-4">
            {causalEffects.length === 0 ? (
              <Card className="bg-gray-900/50 border-gray-800">
                <CardContent className="p-12 text-center">
                  <Target className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No Effects Estimated Yet</h3>
                  <p className="text-gray-400 mb-4">
                    Select a causal graph and run analysis to estimate causal effects
                  </p>
                  <Button onClick={() => setActiveTab('graphs')}>
                    Go to Causal Graphs
                  </Button>
                </CardContent>
              </Card>
            ) : (
              causalEffects.map((effect, i) => (
                <Card key={i} className="bg-gray-900/50 border-gray-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className="px-3 py-1 bg-blue-500/10 rounded text-blue-400 font-medium">
                            {effect.treatment}
                          </div>
                          <ArrowRight className="h-4 w-4 text-gray-500" />
                          <div className="px-3 py-1 bg-green-500/10 rounded text-green-400 font-medium">
                            {effect.outcome}
                          </div>
                        </div>
                      </div>
                      <Badge className={effect.isSignificant ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}>
                        {effect.isSignificant ? 'Significant' : 'Not Significant'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-4 gap-4 mt-4 p-3 bg-gray-800/50 rounded-lg">
                      <div>
                        <p className="text-sm text-gray-400">Causal Effect</p>
                        <p className="text-2xl font-bold text-white">
                          {effect.estimate > 0 ? '+' : ''}{(effect.estimate * 100).toFixed(2)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">95% CI</p>
                        <p className="text-lg font-medium text-white">
                          [{(effect.confidenceInterval[0] * 100).toFixed(1)}%, {(effect.confidenceInterval[1] * 100).toFixed(1)}%]
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">P-Value</p>
                        <p className={`text-lg font-medium ${effect.pValue < 0.05 ? 'text-green-400' : 'text-gray-400'}`}>
                          {effect.pValue.toFixed(4)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Significance</p>
                        <p className="text-lg font-medium text-white">
                          {effect.isSignificant ? (
                            <CheckCircle2 className="h-6 w-6 text-green-400" />
                          ) : (
                            <AlertTriangle className="h-6 w-6 text-yellow-400" />
                          )}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="abtests" className="mt-6">
          <div className="grid gap-4">
            {abTests.map(test => (
              <Card key={test.id} className="bg-gray-900/50 border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{test.name}</h3>
                      <p className="text-sm text-gray-400">Metric: {test.metric}</p>
                    </div>
                    {getStatusBadge(test.status)}
                  </div>

                  <div className="grid grid-cols-5 gap-4 p-4 bg-gray-800/50 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-400">Treatment Size</p>
                      <p className="text-xl font-bold text-white">{test.sampleSize.treatment.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Control Size</p>
                      <p className="text-xl font-bold text-white">{test.sampleSize.control.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Effect Size</p>
                      <p className={`text-xl font-bold ${test.effect > 0 ? 'text-green-400' : test.effect < 0 ? 'text-red-400' : 'text-white'}`}>
                        {test.effect > 0 ? '+' : ''}{(test.effect * 100).toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">P-Value</p>
                      <p className={`text-xl font-bold ${test.pValue < 0.05 ? 'text-green-400' : 'text-yellow-400'}`}>
                        {test.pValue.toFixed(4)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Statistical Power</p>
                      <p className={`text-xl font-bold ${test.power >= 0.8 ? 'text-green-400' : 'text-yellow-400'}`}>
                        {(test.power * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>

                  {test.status === 'running' && (
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <HelpCircle className="h-4 w-4" />
                        {test.power < 0.8 && `Need ~${Math.ceil((test.sampleSize.treatment + test.sampleSize.control) / test.power * 0.8).toLocaleString()} total samples for 80% power`}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <BarChart3 className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                        <Button variant="outline" size="sm" className="text-red-400 border-red-500/50">
                          Stop Test
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            <Button variant="outline" className="mt-4">
              <FlaskConical className="h-4 w-4 mr-2" />
              Create New A/B Test
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="counterfactual" className="mt-6">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Counterfactual Analysis</CardTitle>
              <CardDescription>
                Explore &quot;what if&quot; scenarios by simulating alternative interventions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label>Select Causal Graph</Label>
                    <Select defaultValue={graphs[0]?.id}>
                      <SelectTrigger className="bg-gray-800 border-gray-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {graphs.map(g => (
                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Original Observation</Label>
                    <div className="p-3 bg-gray-800/50 rounded-lg mt-2 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">campaign_exposure</span>
                        <Input type="number" defaultValue="0" className="w-20 h-8 bg-gray-700 border-gray-600" />
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">income</span>
                        <Input type="number" defaultValue="50000" className="w-20 h-8 bg-gray-700 border-gray-600" />
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">age</span>
                        <Input type="number" defaultValue="35" className="w-20 h-8 bg-gray-700 border-gray-600" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Intervention (What If?)</Label>
                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg mt-2 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-blue-300">campaign_exposure</span>
                        <Input type="number" defaultValue="1" className="w-20 h-8 bg-gray-700 border-blue-500/50" />
                      </div>
                    </div>
                  </div>

                  <Button className="w-full">
                    <Play className="h-4 w-4 mr-2" />
                    Compute Counterfactual
                  </Button>
                </div>

                <div className="p-6 bg-gray-800/30 rounded-lg border border-gray-700">
                  <h4 className="text-lg font-medium text-white mb-4">Counterfactual Result</h4>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                      <div>
                        <p className="text-sm text-gray-400">Original Outcome</p>
                        <p className="text-2xl font-bold text-white">$127.50</p>
                      </div>
                      <ArrowRight className="h-6 w-6 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-400">Counterfactual Outcome</p>
                        <p className="text-2xl font-bold text-green-400">$156.20</p>
                      </div>
                    </div>

                    <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
                      <p className="text-sm text-gray-400">Estimated Causal Effect</p>
                      <p className="text-3xl font-bold text-green-400">+$28.70</p>
                      <p className="text-sm text-green-300/70">+22.5% increase</p>
                    </div>

                    <p className="text-sm text-gray-400">
                      If this customer had been exposed to the campaign (intervention),
                      their expected purchase value would increase by $28.70 compared to 
                      not being exposed.
                    </p>
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
