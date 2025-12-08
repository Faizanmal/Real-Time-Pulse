'use client';

import React, { useState, useEffect } from 'react';
import { useARVisualization } from '@/hooks/useAdvancedFeatures';
import type { ARScene } from '@/hooks/useAdvancedFeatures.types';
import type { ARSceneInput } from '@/lib/advanced-features-api';
import { arVisualizationAPI } from '@/lib/advanced-features-api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import NextImage from 'next/image';
import {
  Box,
  Plus,
  QrCode,
  Eye,
  Layers,
  Download,
  Trash2,
  Edit2,
  Smartphone,
  Globe,
  BarChart3,
  Copy,
  Check,
} from 'lucide-react';

// Using shared ARScene and ARSceneInput types from the hooks type definitions

const VISUALIZATION_TYPES = [
  { value: '3d-chart', label: '3D Chart', icon: BarChart3 },
  { value: 'spatial-data', label: 'Spatial Data', icon: Globe },
  { value: 'holographic', label: 'Holographic', icon: Box },
  { value: 'overlay', label: 'AR Overlay', icon: Layers },
];

export function ARVisualizationPanel() {
  const { scenes, loading, fetchScenes, createScene, getQRCode } =
    useARVisualization();

  const [selectedScene, setSelectedScene] = useState<ARScene | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newScene, setNewScene] = useState<ARSceneInput>({
    name: '',
    description: '',
    type: 'portal',
    targetId: '',
    visualizationType: '3d-chart',
  });
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    fetchScenes();
  }, [fetchScenes]);

  const handleCreateScene = async () => {
    if (!newScene.name) return;

    try {
      // Build input for API: prefer config but include visualizationType at top-level as well
      const input = {
        name: newScene.name,
        description: newScene.description,
        type: newScene.type as 'portal' | 'widget' | 'custom',
        targetId: newScene.targetId || undefined,
        config: newScene.config ?? { visualizationType: newScene.visualizationType as '3d-chart' | 'spatial-data' | 'holographic' | 'overlay' | undefined },
        visualizationType: newScene.visualizationType,
      };
      await createScene(input as ARSceneInput);
      setIsCreating(false);
      setNewScene({
        name: '',
        description: '',
        type: 'portal',
        targetId: '',
        visualizationType: '3d-chart',
      });
    } catch (error) {
      console.error('Failed to create scene:', error);
    }
  };

  const handleDeleteScene = async (sceneId: string) => {
    if (!confirm('Are you sure you want to delete this AR scene?')) return;

    try {
      await arVisualizationAPI.deleteScene(sceneId);
      fetchScenes();
      if (selectedScene?.id === sceneId) {
        setSelectedScene(null);
      }
    } catch (error) {
      console.error('Failed to delete scene:', error);
    }
  };

  const handleGetQRCode = async (sceneId: string) => {
    try {
      const result = await getQRCode(sceneId);
      setQrCodeUrl(result.qrCode);
    } catch (error) {
      console.error('Failed to get QR code:', error);
    }
  };



  const handleExportAFrame = async (scene: ARScene) => {
    try {
      // Skip export for custom scenes as they don't have a target
      if (scene.type === 'custom') {
        console.warn('Cannot export custom AR scenes to A-Frame');
        return;
      }

      if (!scene.type || scene.type === 'custom') return; // only portal or widget
      const sceneDefinition = await arVisualizationAPI.generateSceneDefinition({
        type: scene.type as 'portal' | 'widget',
        targetId: scene.targetId || scene.id || '',
        visualizationType: (scene.config?.visualizationType || scene.visualizationType || '') as string,
        data: {},
      });
      const aframe = await arVisualizationAPI.exportToAFrame(sceneDefinition);
      
      const blob = new Blob([aframe.html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${scene.name.replace(/\s+/g, '-')}-aframe.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export:', error);
    }
  };

  const copyViewerLink = async (sceneId: string) => {
    const link = `${window.location.origin}/ar/view/${sceneId}`;
    await navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-pink-500 to-violet-500 rounded-lg">
            <Box className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">AR Visualization</h2>
            <p className="text-sm text-gray-600">
              Create immersive augmented reality data visualizations
            </p>
          </div>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create AR Scene
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pink-100 rounded-lg">
              <Box className="h-5 w-5 text-pink-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{scenes.length}</p>
              <p className="text-sm text-gray-600">Total Scenes</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 rounded-lg">
              <QrCode className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {scenes.filter((s: ARScene) => s.qrCode).length}
              </p>
              <p className="text-sm text-gray-600">QR Enabled</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Smartphone className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">WebXR</p>
              <p className="text-sm text-gray-600">Compatible</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scenes List */}
        <div className="lg:col-span-2">
          {isCreating ? (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Create AR Scene</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Scene Name</label>
                  <Input
                    placeholder="e.g., Revenue Dashboard AR"
                    value={newScene.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewScene({ ...newScene, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <Input
                    placeholder="Optional description"
                    value={newScene.description}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewScene({ ...newScene, description: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Type</label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg"
                      value={newScene.type}
                      onChange={(e) =>
                        setNewScene({ ...newScene, type: e.target.value as ARSceneInput['type'] })
                      }
                    >
                      <option value="portal">Portal</option>
                      <option value="widget">Widget</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Target ID</label>
                    <Input
                      placeholder="Portal or Widget ID"
                      value={newScene.targetId}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setNewScene({ ...newScene, targetId: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Visualization Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {VISUALIZATION_TYPES.map((type) => (
                      <button
                        key={type.value}
                        onClick={() =>
                          setNewScene({ ...newScene, visualizationType: type.value })
                        }
                        className={`p-3 border rounded-lg flex items-center gap-2 ${
                          newScene.visualizationType === type.value
                            ? 'border-violet-500 bg-violet-50 text-violet-700'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <type.icon className="h-5 w-5" />
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsCreating(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateScene} disabled={!newScene.name}>
                    Create Scene
                  </Button>
                </div>
              </div>
            </Card>
          ) : loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="p-4 animate-pulse">
                  <div className="h-32 bg-gray-200 rounded-lg mb-3" />
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </Card>
              ))}
            </div>
          ) : scenes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scenes.map((scene: ARScene) => (
                <Card
                  key={scene.id}
                  className={`overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                    selectedScene?.id === scene.id ? 'ring-2 ring-violet-500' : ''
                  }`}
                  onClick={() => setSelectedScene(scene)}
                >
                  <div className="h-32 bg-gradient-to-br from-pink-400 to-violet-500 flex items-center justify-center">
                    <Box className="h-16 w-16 text-white opacity-50" />
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="capitalize">
                        {scene.type}
                      </Badge>
                      <Badge className="bg-violet-100 text-violet-700">
                        {String(scene.config?.visualizationType || scene.visualizationType || 'Unknown')}
                      </Badge>
                    </div>
                    <h3 className="font-semibold mb-1">{scene.name}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {scene.description || 'No description'}
                    </p>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <span className="text-xs text-gray-500">
                        {scene.createdAt ? new Date(scene.createdAt).toLocaleDateString() : 'Unknown'}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                            e.stopPropagation();
                            handleGetQRCode(scene.id);
                          }}
                        >
                          <QrCode className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                            e.stopPropagation();
                            handleExportAFrame(scene);
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Box className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-600">No AR scenes yet</h3>
              <p className="text-sm text-gray-500 mt-1 mb-4">
                Create your first augmented reality visualization
              </p>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Scene
              </Button>
            </Card>
          )}
        </div>

        {/* Details Panel */}
        <div className="space-y-4">
          {selectedScene ? (
            <>
              <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium">Scene Details</h4>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      onClick={() => handleDeleteScene(selectedScene.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Name</span>
                    <span className="font-medium">{selectedScene.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Type</span>
                    <Badge variant="outline" className="capitalize">
                      {selectedScene.type}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Visualization</span>
                    <span className="capitalize">
                      {String(selectedScene.config?.visualizationType || selectedScene.visualizationType || 'Unknown')}
                    </span>
                  </div>
                  {selectedScene.targetId && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Target ID</span>
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                        {selectedScene.targetId.slice(0, 12)}...
                      </code>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-4">
                <h4 className="font-medium mb-3">Quick Actions</h4>
                <div className="space-y-2">
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() => handleGetQRCode(selectedScene.id)}
                  >
                    <QrCode className="h-4 w-4 mr-2" />
                    Generate QR Code
                  </Button>
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() => copyViewerLink(selectedScene.id)}
                  >
                    {copiedLink ? (
                      <Check className="h-4 w-4 mr-2" />
                    ) : (
                      <Copy className="h-4 w-4 mr-2" />
                    )}
                    {copiedLink ? 'Copied!' : 'Copy Viewer Link'}
                  </Button>
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() => handleExportAFrame(selectedScene)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export A-Frame HTML
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Eye className="h-4 w-4 mr-2" />
                    Preview in Browser
                  </Button>
                </div>
              </Card>

              {/* QR Code Display */}
              {qrCodeUrl && (
                <Card className="p-4">
                  <h4 className="font-medium mb-3">QR Code</h4>
                  <div className="bg-white p-4 rounded-lg border flex items-center justify-center">
                    <NextImage
                      src={qrCodeUrl || ''}
                      alt="AR Scene QR Code"
                      width={192}
                      height={192}
                      className="w-48 h-48"
                    />
                  </div>
                  <p className="text-xs text-center text-gray-500 mt-2">
                    Scan with mobile device to view in AR
                  </p>
                </Card>
              )}
            </>
          ) : (
            <Card className="p-6 text-center">
              <Box className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <h3 className="font-medium text-gray-600">Select a scene</h3>
              <p className="text-sm text-gray-500 mt-1">
                Choose an AR scene to view details
              </p>
            </Card>
          )}

          {/* Tips */}
          <Card className="p-4 bg-violet-50 border-violet-200">
            <h4 className="font-medium text-violet-700 mb-2">AR Tips</h4>
            <div className="text-sm text-violet-600 space-y-1">
              <p>• Use QR codes for quick mobile access</p>
              <p>• 3D charts work best for comparative data</p>
              <p>• Export to A-Frame for custom hosting</p>
              <p>• Test on WebXR compatible browsers</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
