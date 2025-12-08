'use client';

import React, { useState, useEffect } from 'react';
import { useMLModels } from '@/hooks/useAdvancedFeatures';
import type { MLModel } from '@/hooks/useAdvancedFeatures.types';
import { mlMarketplaceAPI } from '@/lib/advanced-features-api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Brain,
  Download,
  Upload,
  Play,
  Cpu,
  TrendingUp,
  BarChart2,
  Target,
  AlertTriangle,
  Star,
  Search,
  RefreshCw,
  Zap,
} from 'lucide-react';

// Using shared MLModel type from hooks types
// Removed unused TrainingJob interface

const MODEL_TYPE_ICONS: Record<string, React.ElementType> = {
  timeseries: TrendingUp,
  classification: Target,
  clustering: BarChart2,
  regression: TrendingUp,
  anomaly: AlertTriangle,
};

const MODEL_TYPE_COLORS: Record<string, string> = {
  timeseries: 'bg-blue-100 text-blue-700',
  classification: 'bg-green-100 text-green-700',
  clustering: 'bg-purple-100 text-purple-700',
  regression: 'bg-orange-100 text-orange-700',
  anomaly: 'bg-red-100 text-red-700',
};

export function MLMarketplacePanel() {
  const { models, marketplace, loading, fetchModels, fetchMarketplace, predict } = useMLModels();
  const [activeTab, setActiveTab] = useState<'my-models' | 'marketplace'>('marketplace');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedModel, setSelectedModel] = useState<MLModel | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictionInput, setPredictionInput] = useState('');
  const [predictionResult, setPredictionResult] = useState<{ error?: string; [key: string]: unknown } | null>(null);

  useEffect(() => {
    fetchModels();
    fetchMarketplace();
  }, [fetchModels, fetchMarketplace]);

  const handlePredict = async () => {
    if (!selectedModel || !predictionInput) return;
    
    setIsPredicting(true);
    try {
      const data = JSON.parse(predictionInput);
      const result = await predict(selectedModel.id, data);
      setPredictionResult(result);
    } catch (error) {
      setPredictionResult({ error: (error as Error).message });
    } finally {
      setIsPredicting(false);
    }
  };

  const handleInstallModel = async (modelId: string) => {
    try {
      await mlMarketplaceAPI.installModel(modelId);
      fetchModels();
    } catch (error) {
      console.error('Failed to install model:', error);
    }
  };

  const filteredModels = (activeTab === 'my-models' ? models : marketplace).filter(
    (model: MLModel) =>
      (selectedCategory === 'all' || model.type === selectedCategory) &&
      (model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.description?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-linear-to-br from-purple-500 to-pink-500 rounded-lg">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">ML Model Marketplace</h2>
            <p className="text-sm text-gray-600">Deploy and use machine learning models</p>
          </div>
        </div>
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          Upload Model
        </Button>
      </div>

      {/* Tabs and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex rounded-lg border overflow-hidden">
          <button
            className={`px-6 py-2 text-sm font-medium ${
              activeTab === 'marketplace'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => setActiveTab('marketplace')}
          >
            Marketplace
          </button>
          <button
            className={`px-6 py-2 text-sm font-medium ${
              activeTab === 'my-models'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => setActiveTab('my-models')}
          >
            My Models ({models.length})
          </button>
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search models..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {['all', 'timeseries', 'classification', 'clustering', 'regression', 'anomaly'].map(
          (category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-1.5 rounded-full text-sm capitalize ${
                selectedCategory === category
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {category}
            </button>
          )
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Models Grid */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="p-4 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
                  <div className="h-3 bg-gray-200 rounded w-full mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                </Card>
              ))}
            </div>
          ) : filteredModels.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredModels.map((model: MLModel) => {
                const TypeIcon = MODEL_TYPE_ICONS[model.type || ''] || Cpu;
                return (
                  <Card
                    key={model.id}
                    className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                      selectedModel?.id === model.id ? 'ring-2 ring-purple-500' : ''
                    }`}
                    onClick={() => setSelectedModel(model)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${MODEL_TYPE_COLORS[model.type || '']}`}>
                          <TypeIcon className="h-4 w-4" />
                        </div>
                        <Badge variant="outline" className="text-xs capitalize">
                          {model.type}
                        </Badge>
                      </div>
                              {typeof model.accuracy === 'number' && (
                                <Badge className="bg-green-100 text-green-700">
                                  {(model.accuracy * 100).toFixed(1)}% acc
                                </Badge>
                              )}
                    </div>
                    <h3 className="font-semibold mb-1">{model.name}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                      {model.description || 'No description available'}
                    </p>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>v{model.version}</span>
                      <div className="flex items-center gap-3">
                        {typeof model.rating === 'number' && (
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                            {model.rating.toFixed(1)}
                          </span>
                        )}
                        {typeof model.downloads === 'number' && (
                          <span className="flex items-center gap-1">
                            <Download className="h-3 w-3" />
                            {model.downloads}
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Brain className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-600">No models found</h3>
              <p className="text-sm text-gray-500 mt-1">
                Try different search terms or browse all categories
              </p>
            </Card>
          )}
        </div>

        {/* Model Details Panel */}
        <div className="lg:col-span-1">
          {selectedModel ? (
            <Card className="p-6 sticky top-4">
              <div className="flex items-center justify-between mb-4">
                <Badge className={MODEL_TYPE_COLORS[selectedModel.type || '']}>
                  {selectedModel.type}
                </Badge>
                <span className="text-sm text-gray-500">v{selectedModel.version}</span>
              </div>

              <h3 className="text-xl font-bold mb-2">{selectedModel.name}</h3>
              <p className="text-sm text-gray-600 mb-4">
                {selectedModel.description || 'No description available'}
              </p>

              {typeof selectedModel.accuracy === 'number' && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Accuracy</span>
                    <span className="font-medium">
                      {(selectedModel.accuracy * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${(selectedModel.accuracy ?? 0) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'marketplace' ? (
                <Button
                  className="w-full mb-4"
                  onClick={() => handleInstallModel(selectedModel.id)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Install Model
                </Button>
              ) : (
                <div className="space-y-3 mb-4">
                  <Button className="w-full" variant="outline">
                    <Zap className="h-4 w-4 mr-2" />
                    Train Model
                  </Button>
                  <Button className="w-full">
                    <Play className="h-4 w-4 mr-2" />
                    Run Prediction
                  </Button>
                </div>
              )}

              {/* Prediction Interface */}
              {activeTab === 'my-models' && (
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium mb-3">Test Prediction</h4>
                  <textarea
                    className="w-full p-3 border rounded-lg text-sm font-mono"
                    rows={4}
                    placeholder='{"data": [1, 2, 3, 4, 5]}'
                    value={predictionInput}
                    onChange={(e) => setPredictionInput(e.target.value)}
                  />
                  <Button
                    className="w-full mt-2"
                    size="sm"
                    onClick={handlePredict}
                    disabled={isPredicting}
                  >
                    {isPredicting ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Predicting...
                      </>
                    ) : (
                      'Run Prediction'
                    )}
                  </Button>

                  {predictionResult && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <h5 className="text-sm font-medium mb-2">Result:</h5>
                      <pre className="text-xs overflow-auto">
                        {JSON.stringify(predictionResult, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              <div className="text-xs text-gray-400 mt-4">
                Created {selectedModel.createdAt ? new Date(selectedModel.createdAt).toLocaleDateString() : '—'}
              </div>
            </Card>
          ) : (
            <Card className="p-6 text-center">
              <Cpu className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <h3 className="font-medium text-gray-600">Select a model</h3>
              <p className="text-sm text-gray-500 mt-1">
                Click on a model to view details and run predictions
              </p>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
