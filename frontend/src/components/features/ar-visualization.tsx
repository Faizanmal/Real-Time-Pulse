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
import { useToast } from '@/hooks/use-toast';
import { arVisualizationApi } from '@/lib/advanced-api';
import type { ARScene, ARSession, ARMarker } from '@/types/advanced-features';
import { Eye, Play, Pause, Settings, Smartphone, Box, MapPin, Plus } from 'lucide-react';

export default function ARVisualization() {
  const [scenes, setScenes] = useState<ARScene[]>([]);
  const [sessions, setSessions] = useState<ARSession[]>([]);
  const [markers, setMarkers] = useState<ARMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScene, setSelectedScene] = useState<ARScene | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadScenes();
    loadSessions();
  }, []);

  const loadScenes = async () => {
    try {
      setLoading(true);
      const data = await arVisualizationApi.getScenes();
      setScenes(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load AR scenes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSessions = async () => {
    try {
      const data = await arVisualizationApi.getSessions();
      setSessions(data);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const createScene = async (sceneData: Partial<ARScene>) => {
    try {
      await arVisualizationApi.createScene(sceneData);
      toast({
        title: 'Success',
        description: 'AR scene created successfully',
      });
      setIsCreateDialogOpen(false);
      loadScenes();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create AR scene',
        variant: 'destructive',
      });
    }
  };

  const startSession = async (sceneId: string) => {
    try {
      const session = await arVisualizationApi.startSession(sceneId, 'web');
      toast({
        title: 'Session Started',
        description: 'AR session is now active',
      });
      loadSessions();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start AR session',
        variant: 'destructive',
      });
    }
  };

  const endSession = async (sessionId: string) => {
    try {
      await arVisualizationApi.endSession(sessionId);
      toast({
        title: 'Session Ended',
        description: 'AR session has been terminated',
      });
      loadSessions();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to end session',
        variant: 'destructive',
      });
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
                          Duration: {Math.round((Date.now() - new Date(session.startTime).getTime()) / 60000)} min
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
          <Card>
            <CardContent className="py-10 text-center">
              <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Marker management coming soon</p>
            </CardContent>
          </Card>
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
                    {selectedScene.objects?.map((obj, i) => (
                      <div key={i} className="flex justify-between">
                        <span>{obj.type}</span>
                        <Badge variant="outline">{obj.dataBinding || 'Static'}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Data Sources</h4>
                  <div className="space-y-1 text-sm">
                    {selectedScene.dataSources?.map((source, i) => (
                      <div key={i} className="flex justify-between">
                        <span>{source.name}</span>
                        <Badge variant="outline">{source.refreshInterval}s</Badge>
                      </div>
                    ))}
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

function CreateSceneForm({ onSubmit }: { onSubmit: (data: Partial<ARScene>) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sceneType, setSceneType] = useState<'dashboard' | 'chart' | 'table'>('dashboard');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description,
      sceneType,
      isActive: true,
      objects: [],
      dataSources: [],
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
        <Select value={sceneType} onValueChange={(v: any) => setSceneType(v)}>
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
