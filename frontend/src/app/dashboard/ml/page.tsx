'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { mlApi, type MLModel, type TrainingJob, type PredictionResult } from '@/lib/api/index';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, Plus, RefreshCw, Play, Trash2, Activity,
  Clock, CheckCircle2, XCircle, Target, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

const modelTypeOptions = [
  { value: 'classification', label: 'Classification' },
  { value: 'regression', label: 'Regression' },
  { value: 'clustering', label: 'Clustering' },
  { value: 'anomaly', label: 'Anomaly Detection' },
  { value: 'forecasting', label: 'Time Series Forecasting' },
];

const statusColors = {
  ready: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  training: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
};

export default function MLPage() {
  const [models, setModels] = useState<MLModel[]>([]);
  const [trainingJobs, setTrainingJobs] = useState<TrainingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [predictDialogOpen, setPredictDialogOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<MLModel | null>(null);
  const [predictionResult, setPredictionResult] = useState<PredictionResult | null>(null);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState('classification');
  const [formDatasetId, setFormDatasetId] = useState('');
  const [predictInput, setPredictInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [training, setTraining] = useState<string | null>(null);
  const [predicting, setPredicting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [modelsData, jobsData] = await Promise.all([
        mlApi.getModels(),
        mlApi.getTrainingJobs(),
      ]);
      setModels(modelsData);
      setTrainingJobs(jobsData);
    } catch (error) {
      console.error('Failed to load ML data:', error);
      toast.error('Failed to load ML data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormType('classification');
    setFormDatasetId('');
  };

  const handleCreate = async () => {
    if (!formName.trim()) {
      toast.error('Please enter a model name');
      return;
    }

    setSaving(true);
    try {
      await mlApi.createModel({
        name: formName,
        description: formDescription || undefined,
        type: formType as MLModel['type'],
        datasetId: formDatasetId || undefined,
      });
      toast.success('Model created');
      setCreateDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Create failed:', error);
      toast.error('Failed to create model');
    } finally {
      setSaving(false);
    }
  };

  const handleTrain = async (modelId: string) => {
    setTraining(modelId);
    try {
      await mlApi.trainModel(modelId, {});
      toast.success('Training started');
      loadData();
    } catch (error) {
      console.error('Training failed:', error);
      toast.error('Failed to start training');
    } finally {
      setTraining(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this model?')) return;

    try {
      await mlApi.deleteModel(id);
      toast.success('Model deleted');
      loadData();
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Failed to delete model');
    }
  };

  const openPredictDialog = (model: MLModel) => {
    setSelectedModel(model);
    setPredictInput('');
    setPredictionResult(null);
    setPredictDialogOpen(true);
  };

  const handlePredict = async () => {
    if (!selectedModel || !predictInput.trim()) {
      toast.error('Please enter input data');
      return;
    }

    setPredicting(true);
    try {
      let inputData;
      try {
        inputData = JSON.parse(predictInput);
      } catch {
        inputData = { text: predictInput };
      }
      
      const result = await mlApi.predict(selectedModel.id, inputData);
      setPredictionResult(result);
    } catch (error) {
      console.error('Prediction failed:', error);
      toast.error('Failed to get prediction');
    } finally {
      setPredicting(false);
    }
  };

  const stats = {
    total: models.length,
    ready: models.filter(m => m.status === 'ready').length,
    training: trainingJobs.filter(j => j.status === 'running').length,
    avgAccuracy: models.filter(m => m.metrics?.accuracy).reduce((sum, m) => sum + (m.metrics?.accuracy || 0), 0) / models.filter(m => m.metrics?.accuracy).length || 0,
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Brain className="h-8 w-8 text-purple-500" />
            Machine Learning
          </h1>
          <p className="text-muted-foreground mt-1">
            Train, deploy, and manage ML models
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Model
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create ML Model</DialogTitle>
                <DialogDescription>
                  Configure a new machine learning model
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Model Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Customer Churn Predictor"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of the model's purpose"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Model Type</Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {modelTypeOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dataset">Dataset ID (optional)</Label>
                  <Input
                    id="dataset"
                    placeholder="Link to training dataset"
                    value={formDatasetId}
                    onChange={(e) => setFormDatasetId(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setCreateDialogOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={saving}>
                  {saving ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Model'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Models</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Brain className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ready to Use</p>
                <p className="text-2xl font-bold">{stats.ready}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Training</p>
                <p className="text-2xl font-bold">{stats.training}</p>
              </div>
              <Activity className={`h-8 w-8 ${stats.training > 0 ? 'text-blue-500 animate-pulse' : 'text-gray-400'}`} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Accuracy</p>
                <p className="text-2xl font-bold">{(stats.avgAccuracy * 100).toFixed(1)}%</p>
              </div>
              <Target className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="models" className="space-y-4">
        <TabsList>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="training">Training Jobs</TabsTrigger>
        </TabsList>

        <TabsContent value="models">
          <Card>
            <CardHeader>
              <CardTitle>ML Models</CardTitle>
              <CardDescription>Your machine learning models</CardDescription>
            </CardHeader>
            <CardContent>
              {models.length === 0 ? (
                <div className="text-center py-12">
                  <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No models yet</h3>
                  <p className="text-muted-foreground mb-4">Create your first ML model</p>
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Model
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <AnimatePresence>
                    {models.map((model, index) => (
                      <motion.div
                        key={model.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className="hover:shadow-md transition-shadow">
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                                  <Brain className="h-5 w-5 text-purple-600" />
                                </div>
                                <div>
                                  <p className="font-medium">{model.name}</p>
                                  <p className="text-xs text-muted-foreground capitalize">{model.type}</p>
                                </div>
                              </div>
                              <Badge className={statusColors[model.status as keyof typeof statusColors]}>
                                {model.status}
                              </Badge>
                            </div>

                            {model.description && (
                              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                {model.description}
                              </p>
                            )}

                            {model.metrics?.accuracy !== undefined && (
                              <div className="mb-3">
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="flex items-center gap-1">
                                    <Target className="h-3 w-3" />
                                    Accuracy
                                  </span>
                                  <span>{(model.metrics.accuracy * 100).toFixed(1)}%</span>
                                </div>
                                <Progress value={model.metrics.accuracy * 100} className="h-1" />
                              </div>
                            )}

                            {model.trainedAt && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mb-3">
                                <Clock className="h-3 w-3" />
                                Trained: {new Date(model.trainedAt).toLocaleDateString()}
                              </p>
                            )}

                            <div className="flex gap-2">
                              {model.status === 'ready' && (
                                <Button 
                                  variant="default" 
                                  size="sm" 
                                  className="flex-1"
                                  onClick={() => openPredictDialog(model)}
                                >
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  Predict
                                </Button>
                              )}
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleTrain(model.id)}
                                disabled={training === model.id || model.status === 'training'}
                              >
                                {training === model.id || model.status === 'training' ? (
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Play className="h-3 w-3" />
                                )}
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleDelete(model.id)}
                                className="text-red-500 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="training">
          <Card>
            <CardHeader>
              <CardTitle>Training Jobs</CardTitle>
              <CardDescription>Active and recent training runs</CardDescription>
            </CardHeader>
            <CardContent>
              {trainingJobs.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No training jobs</h3>
                  <p className="text-muted-foreground">Training jobs will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {trainingJobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${
                          job.status === 'running' ? 'bg-blue-100 dark:bg-blue-900' :
                          job.status === 'completed' ? 'bg-green-100 dark:bg-green-900' :
                          job.status === 'failed' ? 'bg-red-100 dark:bg-red-900' :
                          'bg-gray-100 dark:bg-gray-800'
                        }`}>
                          {job.status === 'running' ? (
                            <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
                          ) : job.status === 'completed' ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : job.status === 'failed' ? (
                            <XCircle className="h-5 w-5 text-red-600" />
                          ) : (
                            <Clock className="h-5 w-5 text-gray-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{job.modelName || job.modelId}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <span>Started: {job.startedAt ? new Date(job.startedAt).toLocaleString() : 'Unknown'}</span>
                            {job.duration && (
                              <>
                                <span>•</span>
                                <span>Duration: {Math.round(job.duration / 1000)}s</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {job.status === 'running' && job.progress !== undefined && (
                          <div className="w-32">
                            <Progress value={job.progress} className="h-2" />
                            <p className="text-xs text-center mt-1">{job.progress}%</p>
                          </div>
                        )}
                        <Badge className={statusColors[job.status as keyof typeof statusColors]}>
                          {job.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Predict Dialog */}
      <Dialog open={predictDialogOpen} onOpenChange={setPredictDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Get Prediction
            </DialogTitle>
            <DialogDescription>
              Model: {selectedModel?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Input Data</Label>
              <Textarea
                placeholder={'Enter JSON data or text input\n{\n  "feature1": value,\n  "feature2": value\n}'}
                value={predictInput}
                onChange={(e) => setPredictInput(e.target.value)}
                rows={5}
                className="font-mono text-sm"
              />
            </div>
            {predictionResult && (
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <p className="text-sm font-medium mb-2">Prediction Result:</p>
                <pre className="text-sm overflow-x-auto">
                  {JSON.stringify(predictionResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPredictDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={handlePredict} disabled={predicting}>
              {predicting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Predicting...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Get Prediction
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
