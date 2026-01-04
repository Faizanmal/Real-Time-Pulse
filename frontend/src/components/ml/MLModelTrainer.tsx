'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Brain,
  Play,
  Upload,
  Settings,
  BarChart3,
  Cpu,
  Zap,
  Target,
  TrendingUp,
  Layers,
  GitBranch,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Activity,
} from 'lucide-react';

interface MLModel {
  id: string;
  name: string;
  type: 'classification' | 'regression' | 'clustering' | 'timeseries' | 'anomaly' | 'nlp';
  framework: string;
  features: string[];
  target?: string;
  status: 'created' | 'training' | 'trained' | 'deployed' | 'failed';
  metrics?: Record<string, number>;
  trainedAt?: string;
}

interface TrainingJob {
  id: string;
  modelId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  startedAt: string;
  completedAt?: string;
  metrics?: Record<string, number>;
  logs: string[];
}

const modelTypes = [
  { value: 'classification', label: 'Classification', icon: Target, description: 'Predict categories' },
  { value: 'regression', label: 'Regression', icon: TrendingUp, description: 'Predict continuous values' },
  { value: 'clustering', label: 'Clustering', icon: Layers, description: 'Group similar data' },
  { value: 'timeseries', label: 'Time Series', icon: Activity, description: 'Forecast trends' },
  { value: 'anomaly', label: 'Anomaly Detection', icon: AlertTriangle, description: 'Find outliers' },
  { value: 'nlp', label: 'NLP', icon: Brain, description: 'Process text' },
];

const algorithms: Record<string, string[]> = {
  classification: ['random_forest', 'xgboost', 'logistic_regression', 'svm', 'neural_network', 'gradient_boosting'],
  regression: ['linear_regression', 'random_forest', 'xgboost', 'neural_network', 'elastic_net', 'gradient_boosting'],
  clustering: ['kmeans', 'dbscan', 'hierarchical', 'gaussian_mixture'],
  timeseries: ['arima', 'prophet', 'lstm', 'xgboost'],
  anomaly: ['isolation_forest', 'one_class_svm', 'autoencoder', 'lof'],
  nlp: ['bert', 'lstm', 'transformer', 'fasttext'],
};

export default function MLModelTrainer() {
  const [models, setModels] = useState<MLModel[]>([
    {
      id: 'model-1',
      name: 'Customer Churn Predictor',
      type: 'classification',
      framework: 'xgboost',
      features: ['tenure', 'monthly_charges', 'total_charges', 'contract_type'],
      target: 'churn',
      status: 'trained',
      metrics: { accuracy: 0.92, precision: 0.89, recall: 0.87, f1: 0.88 },
      trainedAt: '2024-01-15T10:30:00Z',
    },
    {
      id: 'model-2',
      name: 'Revenue Forecaster',
      type: 'regression',
      framework: 'sklearn',
      features: ['month', 'marketing_spend', 'seasonality'],
      target: 'revenue',
      status: 'training',
    },
    {
      id: 'model-3',
      name: 'Anomaly Detector',
      type: 'anomaly',
      framework: 'sklearn',
      features: ['transaction_amount', 'time_since_last', 'frequency'],
      status: 'created',
    },
  ]);

  const [trainingJobs, setTrainingJobs] = useState<TrainingJob[]>([
    {
      id: 'job-1',
      modelId: 'model-2',
      status: 'running',
      progress: 65,
      startedAt: '2024-01-15T11:00:00Z',
      logs: ['Loading data...', 'Preprocessing features...', 'Training epoch 65/100...'],
    },
  ]);

  const [newModel, setNewModel] = useState({
    name: '',
    type: 'classification' as const,
    framework: 'sklearn',
    features: '',
    target: '',
  });

  const [trainingConfig, setTrainingConfig] = useState({
    algorithm: 'random_forest',
    validationSplit: 0.2,
    automl: false,
    hyperparameters: {
      n_estimators: 100,
      max_depth: 10,
      learning_rate: 0.01,
    },
  });

  const [selectedModel, setSelectedModel] = useState<MLModel | null>(null);
  const [activeTab, setActiveTab] = useState('models');

  useEffect(() => {
    // Simulate training progress
    const interval = setInterval(() => {
      setTrainingJobs(prev =>
        prev.map(job => {
          if (job.status === 'running' && job.progress < 100) {
            const newProgress = Math.min(job.progress + Math.random() * 3, 100);
            if (newProgress >= 100) {
              return {
                ...job,
                status: 'completed' as const,
                progress: 100,
                completedAt: new Date().toISOString(),
                metrics: {
                  accuracy: 0.85 + Math.random() * 0.1,
                  loss: 0.1 + Math.random() * 0.1,
                },
              };
            }
            return { ...job, progress: newProgress };
          }
          return job;
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleCreateModel = () => {
    const model: MLModel = {
      id: `model-${Date.now()}`,
      name: newModel.name,
      type: newModel.type,
      framework: newModel.framework,
      features: newModel.features.split(',').map(f => f.trim()).filter(Boolean),
      target: newModel.target || undefined,
      status: 'created',
    };
    setModels(prev => [...prev, model]);
    setNewModel({ name: '', type: 'classification', framework: 'sklearn', features: '', target: '' });
  };

  const handleStartTraining = (modelId: string) => {
    const job: TrainingJob = {
      id: `job-${Date.now()}`,
      modelId,
      status: 'running',
      progress: 0,
      startedAt: new Date().toISOString(),
      logs: ['Initializing training...', 'Loading dataset...'],
    };
    setTrainingJobs(prev => [...prev, job]);
    setModels(prev =>
      prev.map(m => (m.id === modelId ? { ...m, status: 'training' as const } : m))
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'trained':
      case 'deployed':
      case 'completed':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'training':
      case 'running':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'failed':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  return (
    <div className="p-6 space-y-6 bg-gray-950 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Brain className="h-8 w-8 text-purple-400" />
            ML Model Trainer
          </h1>
          <p className="text-gray-400 mt-1">Build, train, and deploy machine learning models</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="border-purple-500/50 text-purple-400">
            <Cpu className="h-3 w-3 mr-1" />
            {trainingJobs.filter(j => j.status === 'running').length} Training
          </Badge>
          <Badge variant="outline" className="border-green-500/50 text-green-400">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {models.filter(m => m.status === 'trained').length} Ready
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-900/50 border border-gray-800">
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="training">Training</TabsTrigger>
          <TabsTrigger value="create">Create New</TabsTrigger>
          <TabsTrigger value="automl">AutoML</TabsTrigger>
        </TabsList>

        <TabsContent value="models" className="mt-6">
          <div className="grid gap-4">
            {models.map(model => (
              <Card key={model.id} className="bg-gray-900/50 border-gray-800 hover:border-gray-700 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-lg bg-purple-500/10">
                        {modelTypes.find(t => t.value === model.type)?.icon &&
                          React.createElement(modelTypes.find(t => t.value === model.type)!.icon, {
                            className: 'h-6 w-6 text-purple-400',
                          })}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{model.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">{model.type}</Badge>
                          <Badge variant="outline" className="text-xs">{model.framework}</Badge>
                          <span className="text-sm text-gray-500">
                            {model.features.length} features
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge className={getStatusColor(model.status)}>
                        {model.status}
                      </Badge>
                      {model.metrics && (
                        <div className="text-right">
                          <p className="text-sm text-gray-400">Accuracy</p>
                          <p className="text-lg font-bold text-green-400">
                            {(model.metrics.accuracy * 100).toFixed(1)}%
                          </p>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedModel(model)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        {model.status === 'created' && (
                          <Button
                            size="sm"
                            onClick={() => handleStartTraining(model.id)}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Train
                          </Button>
                        )}
                        {model.status === 'trained' && (
                          <Button size="sm" variant="outline" className="border-green-500/50 text-green-400">
                            <Zap className="h-4 w-4 mr-1" />
                            Deploy
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {model.status === 'training' && (
                    <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">Training Progress</span>
                        <span className="text-sm text-blue-400">
                          {trainingJobs.find(j => j.modelId === model.id)?.progress.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${trainingJobs.find(j => j.modelId === model.id)?.progress || 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="training" className="mt-6">
          <div className="grid gap-4">
            {trainingJobs.map(job => {
              const model = models.find(m => m.id === job.modelId);
              return (
                <Card key={job.id} className="bg-gray-900/50 border-gray-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          {model?.name || 'Unknown Model'}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-500">
                            Started {new Date(job.startedAt).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      <Badge className={getStatusColor(job.status)}>
                        {job.status}
                      </Badge>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-400">Progress</span>
                          <span className="text-sm font-medium text-white">{job.progress.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-3">
                          <div
                            className={`h-3 rounded-full transition-all duration-500 ${
                              job.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                      </div>

                      {job.metrics && (
                        <div className="grid grid-cols-2 gap-4 p-3 bg-gray-800/50 rounded-lg">
                          {Object.entries(job.metrics).map(([key, value]) => (
                            <div key={key}>
                              <p className="text-sm text-gray-400 capitalize">{key}</p>
                              <p className="text-lg font-bold text-white">
                                {typeof value === 'number' ? value.toFixed(4) : value}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="p-3 bg-gray-950 rounded-lg font-mono text-xs">
                        {job.logs.slice(-5).map((log, i) => (
                          <div key={i} className="text-gray-400">
                            <span className="text-gray-600">[{i + 1}]</span> {log}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="create" className="mt-6">
          <Card className="bg-gray-900/50 border-gray-800 max-w-2xl">
            <CardHeader>
              <CardTitle className="text-white">Create New Model</CardTitle>
              <CardDescription>Configure and create a new machine learning model</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Model Name</Label>
                <Input
                  placeholder="e.g., Customer Churn Predictor"
                  value={newModel.name}
                  onChange={e => setNewModel(prev => ({ ...prev, name: e.target.value }))}
                  className="bg-gray-800 border-gray-700"
                />
              </div>

              <div className="space-y-2">
                <Label>Model Type</Label>
                <div className="grid grid-cols-3 gap-3">
                  {modelTypes.map(type => (
                    <button
                      key={type.value}
                      onClick={() => setNewModel(prev => ({ ...prev, type: type.value as any }))}
                      className={`p-4 rounded-lg border text-left transition-colors ${
                        newModel.type === type.value
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                      }`}
                    >
                      <type.icon className={`h-5 w-5 mb-2 ${
                        newModel.type === type.value ? 'text-purple-400' : 'text-gray-400'
                      }`} />
                      <p className="font-medium text-white">{type.label}</p>
                      <p className="text-xs text-gray-500">{type.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Framework</Label>
                <Select
                  value={newModel.framework}
                  onValueChange={v => setNewModel(prev => ({ ...prev, framework: v }))}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sklearn">scikit-learn</SelectItem>
                    <SelectItem value="tensorflow">TensorFlow</SelectItem>
                    <SelectItem value="pytorch">PyTorch</SelectItem>
                    <SelectItem value="xgboost">XGBoost</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Features (comma-separated)</Label>
                <Input
                  placeholder="e.g., age, income, tenure"
                  value={newModel.features}
                  onChange={e => setNewModel(prev => ({ ...prev, features: e.target.value }))}
                  className="bg-gray-800 border-gray-700"
                />
              </div>

              {newModel.type !== 'clustering' && newModel.type !== 'anomaly' && (
                <div className="space-y-2">
                  <Label>Target Variable</Label>
                  <Input
                    placeholder="e.g., churn, revenue"
                    value={newModel.target}
                    onChange={e => setNewModel(prev => ({ ...prev, target: e.target.value }))}
                    className="bg-gray-800 border-gray-700"
                  />
                </div>
              )}

              <Button
                onClick={handleCreateModel}
                disabled={!newModel.name || !newModel.features}
                className="w-full"
              >
                Create Model
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automl" className="mt-6">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-400" />
                AutoML Configuration
              </CardTitle>
              <CardDescription>Automatically find the best model and hyperparameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                <div>
                  <p className="font-medium text-white">Enable AutoML</p>
                  <p className="text-sm text-gray-400">Automatically search for optimal configurations</p>
                </div>
                <Switch
                  checked={trainingConfig.automl}
                  onCheckedChange={v => setTrainingConfig(prev => ({ ...prev, automl: v }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Algorithm</Label>
                <Select
                  value={trainingConfig.algorithm}
                  onValueChange={v => setTrainingConfig(prev => ({ ...prev, algorithm: v }))}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {algorithms[newModel.type]?.map(algo => (
                      <SelectItem key={algo} value={algo}>
                        {algo.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Validation Split: {(trainingConfig.validationSplit * 100).toFixed(0)}%</Label>
                <Slider
                  value={[trainingConfig.validationSplit * 100]}
                  onValueChange={([v]) => setTrainingConfig(prev => ({ ...prev, validationSplit: v / 100 }))}
                  min={10}
                  max={40}
                  step={5}
                  className="py-4"
                />
              </div>

              <div className="space-y-4">
                <Label>Hyperparameters</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-gray-400">Number of Estimators</Label>
                    <Input
                      type="number"
                      value={trainingConfig.hyperparameters.n_estimators}
                      onChange={e => setTrainingConfig(prev => ({
                        ...prev,
                        hyperparameters: { ...prev.hyperparameters, n_estimators: parseInt(e.target.value) }
                      }))}
                      className="bg-gray-800 border-gray-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-gray-400">Max Depth</Label>
                    <Input
                      type="number"
                      value={trainingConfig.hyperparameters.max_depth}
                      onChange={e => setTrainingConfig(prev => ({
                        ...prev,
                        hyperparameters: { ...prev.hyperparameters, max_depth: parseInt(e.target.value) }
                      }))}
                      className="bg-gray-800 border-gray-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-gray-400">Learning Rate</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={trainingConfig.hyperparameters.learning_rate}
                      onChange={e => setTrainingConfig(prev => ({
                        ...prev,
                        hyperparameters: { ...prev.hyperparameters, learning_rate: parseFloat(e.target.value) }
                      }))}
                      className="bg-gray-800 border-gray-700"
                    />
                  </div>
                </div>
              </div>

              <Button className="w-full" disabled={trainingConfig.automl && !selectedModel}>
                <Zap className="h-4 w-4 mr-2" />
                {trainingConfig.automl ? 'Start AutoML Search' : 'Apply Configuration'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Model Details Modal */}
      {selectedModel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedModel(null)}>
          <Card className="bg-gray-900 border-gray-800 w-full max-w-2xl m-4" onClick={e => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                {selectedModel.name}
                <Button variant="ghost" size="sm" onClick={() => setSelectedModel(null)}>×</Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Type</p>
                  <p className="text-white capitalize">{selectedModel.type}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Framework</p>
                  <p className="text-white">{selectedModel.framework}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Status</p>
                  <Badge className={getStatusColor(selectedModel.status)}>{selectedModel.status}</Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Target</p>
                  <p className="text-white">{selectedModel.target || 'N/A'}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-400 mb-2">Features</p>
                <div className="flex flex-wrap gap-2">
                  {selectedModel.features.map(f => (
                    <Badge key={f} variant="outline">{f}</Badge>
                  ))}
                </div>
              </div>

              {selectedModel.metrics && (
                <div>
                  <p className="text-sm text-gray-400 mb-2">Performance Metrics</p>
                  <div className="grid grid-cols-4 gap-3">
                    {Object.entries(selectedModel.metrics).map(([key, value]) => (
                      <div key={key} className="p-3 bg-gray-800/50 rounded-lg text-center">
                        <p className="text-xs text-gray-400 capitalize">{key}</p>
                        <p className="text-xl font-bold text-white">{(value * 100).toFixed(1)}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
