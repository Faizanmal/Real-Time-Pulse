'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { arVisualizationApi } from '@/lib/advanced-api';
import type { ARScene, ARSession, ARMarker } from '@/types/advanced-features';
import { Eye, Play, Pause, Smartphone, Box, MapPin, Plus, QrCode, Trash2, Loader2, ImageIcon } from 'lucide-react';

export default function ARVisualization() {
  const [scenes, setScenes] = useState<ARScene[]>([]);
  const [sessions, setSessions] = useState<ARSession[]>([]);
  const [markers, setMarkers] = useState<ARMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [markersLoading, setMarkersLoading] = useState(false);
  const [selectedScene, setSelectedScene] = useState<ARScene | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreateMarkerOpen, setIsCreateMarkerOpen] = useState(false);
  const [deletingMarkerId, setDeletingMarkerId] = useState<string | null>(null);

  useEffect(() => {
    loadScenes();
    loadSessions();
    loadMarkers();
  }, []);

  const loadScenes = async () => {
    try {
      setLoading(true);
      const data = await arVisualizationApi.getScenes();
      setScenes(data.data);
    } catch {
      toast.error('Failed to load AR scenes');
    } finally {
      setLoading(false);
    }
  };

  const loadSessions = async () => {
    try {
      const data = await arVisualizationApi.getAllSessions();
      setSessions(data.data);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const loadMarkers = async () => {
    try {
      setMarkersLoading(true);
      const data = await arVisualizationApi.getMarkers();
      setMarkers(data.data);
    } catch (error) {
      console.error('Failed to load markers:', error);
    } finally {
      setMarkersLoading(false);
    }
  };

  const createScene = async (sceneData: { name: string; description?: string; portalId?: string; sceneData: unknown; modelUrls: unknown }) => {
    try {
      await arVisualizationApi.createScene({
        ...sceneData,
        sceneData: sceneData.sceneData as Record<string, unknown>,
        modelUrls: sceneData.modelUrls as string[]
      });
      toast.success('AR scene created successfully');
      setIsCreateDialogOpen(false);
      loadScenes();
    } catch {
      toast.error('Failed to create AR scene');
    }
  };

  const createMarker = async (data: { sceneId: string; type: 'qr' | 'image' | 'location'; location?: { lat: number; lng: number; radius: number } }) => {
    try {
      await arVisualizationApi.createMarker(data.sceneId, { type: data.type, location: data.location });
      toast.success('AR marker created successfully');
      setIsCreateMarkerOpen(false);
      loadMarkers();
    } catch {
      toast.error('Failed to create marker');
    }
  };

  const deleteMarker = async (markerId: string) => {
    try {
      setDeletingMarkerId(markerId);
      await arVisualizationApi.deleteMarker(markerId);
      toast.success('Marker deleted successfully');
      loadMarkers();
    } catch {
      toast.error('Failed to delete marker');
    } finally {
      setDeletingMarkerId(null);
    }
  };

  const startSession = async (sceneId: string) => {
    try {
      await arVisualizationApi.startSession(sceneId, 'web');
      toast.success('AR session is now active');
      loadSessions();
    } catch {
      toast.error('Failed to start AR session');
    }
  };

  const endSession = async (sessionId: string) => {
    try {
      await arVisualizationApi.endSession(sessionId);
      toast.success('AR session has been terminated');
      loadSessions();
    } catch {
      toast.error('Failed to end session');
    }
  };

  const getMarkerIcon = (type: string) => {
    switch (type) {
      case 'qr':
        return <QrCode className="h-5 w-5" />;
      case 'image':
        return <ImageIcon className="h-5 w-5" />;
      case 'location':
        return <MapPin className="h-5 w-5" />;
      default:
        return <MapPin className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">AR Visualization</h2>
          <p className="text-muted-foreground">Visualize your data in augmented reality</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Scene
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create AR Scene</DialogTitle>
              <DialogDescription>Configure a new augmented reality scene</DialogDescription>
            </DialogHeader>
            <CreateSceneForm onSubmit={createScene} />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="scenes" className="w-full">
        <TabsList>
          <TabsTrigger value="scenes">Scenes</TabsTrigger>
          <TabsTrigger value="sessions">Active Sessions</TabsTrigger>
          <TabsTrigger value="markers">Markers</TabsTrigger>
        </TabsList>

        <TabsContent value="scenes" className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-muted-foreground">Loading scenes...</p>
              </CardContent>
            </Card>
          ) : scenes.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Box className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No AR scenes created yet</p>
                <Button className="mt-4" onClick={() => setIsCreateDialogOpen(true)}>
                  Create Your First Scene
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {scenes.map((scene) => (
                <Card key={scene.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{scene.name}</CardTitle>
                        <CardDescription className="mt-1">{scene.description}</CardDescription>
                      </div>
                      <Badge variant={scene.isActive ? 'default' : 'secondary'}>
                        {scene.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Type:</span>
                          <span className="font-medium capitalize">{scene.sceneType}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Objects:</span>
                          <span className="font-medium">{scene.objects?.length || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Data Sources:</span>
                          <span className="font-medium">{scene.dataSources?.length || 0}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setSelectedScene(scene)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => startSession(scene.id)}
                          disabled={!scene.isActive}
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Start
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          {sessions.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Smartphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No active AR sessions</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {sessions.map((session) => (
                <Card key={session.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">Session {session.id.slice(0, 8)}</h3>
                          <Badge variant={session.status === 'active' ? 'default' : 'secondary'}>
                            {session.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Device: {session.deviceInfo?.type || 'Unknown'} • 
                          Duration: {session.startTime ? Math.round((Date.now() - new Date(session.startTime).getTime()) / 60000) : 0} min
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => endSession(session.id)}
                      >
                        <Pause className="mr-2 h-4 w-4" />
                        End Session
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="markers" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">AR Markers</h3>
              <p className="text-sm text-muted-foreground">Manage QR codes, image targets, and location-based markers</p>
            </div>
            <Dialog open={isCreateMarkerOpen} onOpenChange={setIsCreateMarkerOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={scenes.length === 0}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Marker
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create AR Marker</DialogTitle>
                  <DialogDescription>Add a new marker to an AR scene</DialogDescription>
                </DialogHeader>
                <CreateMarkerForm scenes={scenes} onSubmit={createMarker} />
              </DialogContent>
            </Dialog>
          </div>

          {markersLoading ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">Loading markers...</p>
              </CardContent>
            </Card>
          ) : markers.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No markers created yet</p>
                {scenes.length === 0 ? (
                  <p className="text-sm text-muted-foreground mt-2">Create a scene first to add markers</p>
                ) : (
                  <Button className="mt-4" size="sm" onClick={() => setIsCreateMarkerOpen(true)}>
                    Create Your First Marker
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {markers.map((marker) => {
                const scene = scenes.find(s => s.id === marker.sceneId);
                return (
                  <Card key={marker.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            {getMarkerIcon(marker.type)}
                          </div>
                          <div>
                            <CardTitle className="text-base capitalize">{marker.type} Marker</CardTitle>
                            <CardDescription className="text-xs">{scene?.name || 'Unknown Scene'}</CardDescription>
                          </div>
                        </div>
                        <Badge variant={marker.isActive ? 'default' : 'secondary'}>
                          {marker.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Position:</span>
                            <span className="font-mono text-xs">
                              ({marker.position?.x?.toFixed(1) || 0}, {marker.position?.y?.toFixed(1) || 0}, {marker.position?.z?.toFixed(1) || 0})
                            </span>
                          </div>
                          {marker.type === 'location' && (marker.data as { location?: { lat: number; lng: number } })?.location && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Lat:</span>
                                <span className="font-mono text-xs">{(marker.data as { location: { lat: number; lng: number } }).location.lat}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Lng:</span>
                                <span className="font-mono text-xs">{(marker.data as { location: { lat: number; lng: number } }).location.lng}</span>
                              </div>
                            </>
                          )} 
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Created:</span>
                            <span className="text-xs">{new Date(marker.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="w-full"
                          onClick={() => deleteMarker(marker.id)}
                          disabled={deletingMarkerId === marker.id}
                        >
                          {deletingMarkerId === marker.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="mr-2 h-4 w-4" />
                          )}
                          Delete Marker
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selectedScene && (
        <Dialog open={!!selectedScene} onOpenChange={() => setSelectedScene(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{selectedScene.name}</DialogTitle>
              <DialogDescription>{selectedScene.description}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-8 aspect-video flex items-center justify-center">
                <div className="text-center">
                  <Box className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">3D Scene Viewer</p>
                  <p className="text-sm text-muted-foreground mt-2">WebGL/Three.js integration coming soon</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Scene Objects</h4>
                  <div className="space-y-1 text-sm">
                    {selectedScene.objects?.map((obj, i) => {
                      const typedObj = obj as { type: string; dataBinding?: string };
                      return (
                        <div key={i} className="flex justify-between">
                          <span>{typedObj.type}</span>
                          <Badge variant="outline">{typedObj.dataBinding || 'Static'}</Badge>
                        </div>
                      );
                    })} 
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Data Sources</h4>
                  <div className="space-y-1 text-sm">
                    {selectedScene.dataSources?.map((source, i) => {
                      const typedSource = source as { name: string; refreshInterval: number };
                      return (
                        <div key={i} className="flex justify-between">
                          <span>{typedSource.name}</span>
                          <Badge variant="outline">{typedSource.refreshInterval}s</Badge>
                        </div>
                      );
                    })} 
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function CreateSceneForm({ onSubmit }: { onSubmit: (data: { name: string; description?: string; portalId?: string; sceneData: unknown; modelUrls: unknown }) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sceneType, setSceneType] = useState<'dashboard' | 'chart' | 'table'>('dashboard');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description,
      sceneData: { sceneType },
      modelUrls: {},
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Scene Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sales Dashboard AR"
          required
        />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Visualize sales metrics in 3D space"
          rows={3}
        />
      </div>
      <div>
        <Label htmlFor="sceneType">Scene Type</Label>
        <Select value={sceneType} onValueChange={(v: 'dashboard' | 'chart' | 'table') => setSceneType(v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dashboard">Dashboard</SelectItem>
            <SelectItem value="chart">Chart</SelectItem>
            <SelectItem value="table">Table</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full">Create Scene</Button>
    </form>
  );
}

function CreateMarkerForm({ 
  scenes, 
  onSubmit 
}: { 
  scenes: ARScene[];
  onSubmit: (data: { sceneId: string; type: 'qr' | 'image' | 'location'; location?: { lat: number; lng: number; radius: number } }) => void;
}) {
  const [sceneId, setSceneId] = useState(scenes[0]?.id || '');
  const [markerType, setMarkerType] = useState<'qr' | 'image' | 'location'>('qr');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState('100');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: { sceneId: string; type: 'qr' | 'image' | 'location'; location?: { lat: number; lng: number; radius: number } } = {
      sceneId,
      type: markerType,
    };
    
    if (markerType === 'location' && lat && lng) {
      data.location = {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        radius: parseFloat(radius) || 100,
      };
    }
    
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="scene">Scene</Label>
        <Select value={sceneId} onValueChange={setSceneId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a scene" />
          </SelectTrigger>
          <SelectContent>
            {scenes.map((scene) => (
              <SelectItem key={scene.id} value={scene.id}>
                {scene.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label htmlFor="markerType">Marker Type</Label>
        <Select value={markerType} onValueChange={(v: 'qr' | 'image' | 'location') => setMarkerType(v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="qr">
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4" />
                QR Code
              </div>
            </SelectItem>
            <SelectItem value="image">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Image Target
              </div>
            </SelectItem>
            <SelectItem value="location">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Location-based
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {markerType === 'location' && (
        <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
          <p className="text-sm font-medium">Location Settings</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="lat">Latitude</Label>
              <Input
                id="lat"
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="40.7128"
                required={markerType === 'location'}
              />
            </div>
            <div>
              <Label htmlFor="lng">Longitude</Label>
              <Input
                id="lng"
                type="number"
                step="any"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="-74.0060"
                required={markerType === 'location'}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="radius">Trigger Radius (meters)</Label>
            <Input
              id="radius"
              type="number"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              placeholder="100"
            />
          </div>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={!sceneId}>
        Create Marker
      </Button>
    </form>
  );
}
