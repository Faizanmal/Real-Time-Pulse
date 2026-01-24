'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, Zap, TrendingUp, Target, Sparkles, AlertCircle } from 'lucide-react';

interface AIModel {
  id: string;
  name: string;
  type: string;
  accuracy: number;
  status: string;
  lastTrained: string;
}

interface Prediction {
  id: string;
  model: string;
  prediction: Record<string, unknown>;
  confidence: number;
  timestamp: string;
}

export default function AdvancedAI() {
  const [models, setModels] = useState<AIModel[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [_loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const load = async () => {
      await fetchModels();
      await fetchPredictions();
    };
    load();
  }, []);

  const fetchModels = async () => {
    try {
      const response = await fetch('/api/advanced-ai/models');
      const data = await response.json();
      setModels(data);
    } catch (error) {
      console.error('Failed to fetch models:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPredictions = async () => {
    try {
      const response = await fetch('/api/advanced-ai/predictions');
      const data = await response.json();
      setPredictions(data);
    } catch (error) {
      console.error('Failed to fetch predictions:', error);
    }
  };

  const trainModel = async (modelId: string) => {
    try {
      await fetch(`/api/advanced-ai/models/${modelId}/train`, { method: 'POST' });
      fetchModels();
    } catch (error) {
      console.error('Failed to train model:', error);
    }
  };

  const runPrediction = async (modelId: string) => {
    try {
      await fetch(`/api/advanced-ai/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId })
      });
      fetchPredictions();
    } catch (error) {
      console.error('Failed to run prediction:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8" />
            Advanced AI
          </h1>
          <p className="text-muted-foreground">Enterprise-grade AI models and predictions</p>
        </div>
        <Button>
          <Sparkles className="h-4 w-4 mr-2" />
          New Model
        </Button>
      </div>

      <Tabs defaultValue="models" className="space-y-4">
        <TabsList>
          <TabsTrigger value="models">AI Models</TabsTrigger>
          <TabsTrigger value="predictions">Predictions</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
        </TabsList>

        <TabsContent value="models" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {models.map((model) => (
              <Card key={model.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{model.name}</CardTitle>
                    <Badge variant={model.status === 'active' ? 'default' : 'secondary'}>
                      {model.status}
                    </Badge>
                  </div>
                  <CardDescription>{model.type}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Accuracy</span>
                        <span className="font-semibold">{(model.accuracy * 100).toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-primary h-full transition-all"
                          style={{ width: `${model.accuracy * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Last trained: {new Date(model.lastTrained).toLocaleDateString()}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => trainModel(model.id)}>
                        <Zap className="h-3 w-3 mr-1" />
                        Train
                      </Button>
                      <Button size="sm" onClick={() => runPrediction(model.id)}>
                        <Target className="h-3 w-3 mr-1" />
                        Predict
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="predictions" className="space-y-4">
          {predictions.map((prediction) => (
            <Card key={prediction.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base">{prediction.model}</CardTitle>
                  <Badge variant="outline">
                    {(prediction.confidence * 100).toFixed(1)}% confidence
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="text-sm bg-secondary p-3 rounded overflow-x-auto">
                  {JSON.stringify(prediction.prediction, null, 2)}
                </pre>
                <div className="text-xs text-muted-foreground mt-2">
                  {new Date(prediction.timestamp).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Model Performance Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-secondary rounded-lg">
                    <div className="text-2xl font-bold">98.5%</div>
                    <div className="text-sm text-muted-foreground">Avg Accuracy</div>
                  </div>
                  <div className="text-center p-4 bg-secondary rounded-lg">
                    <div className="text-2xl font-bold">2,341</div>
                    <div className="text-sm text-muted-foreground">Predictions</div>
                  </div>
                  <div className="text-center p-4 bg-secondary rounded-lg">
                    <div className="text-2xl font-bold">12</div>
                    <div className="text-sm text-muted-foreground">Active Models</div>
                  </div>
                  <div className="text-center p-4 bg-secondary rounded-lg">
                    <div className="text-2xl font-bold">156ms</div>
                    <div className="text-sm text-muted-foreground">Avg Response</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Auto-Optimization</CardTitle>
              <CardDescription>Automatic model tuning and hyperparameter optimization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-semibold text-sm">Auto-optimization enabled</div>
                    <div className="text-sm text-muted-foreground">
                      Models will be automatically retrained when performance drops below threshold
                    </div>
                  </div>
                </div>
                <Button variant="outline" className="w-full">Configure Optimization Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
