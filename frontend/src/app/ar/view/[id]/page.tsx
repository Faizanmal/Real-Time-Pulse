'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { arVisualizationApi } from '@/lib/advanced-api';
import type { ARScene } from '@/types/advanced-features';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Box, AlertTriangle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export default function ARSceneViewerPage() {
    const params = useParams();
    const id = params.id as string;
    const [scene, setScene] = useState<ARScene | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (id) {
            loadScene(id);
        }
    }, [id]);

    const loadScene = async (sceneId: string) => {
        try {
            setLoading(true);
            const response = await arVisualizationApi.getScene(sceneId);
            if (response.data) {
                setScene(response.data);
            } else {
                setError('Scene not found');
            }
        } catch (err) {
            console.error('Failed to load scene:', err);
            setError('Failed to load scene details');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-muted-foreground">Loading AR Experience...</p>
                </div>
            </div>
        );
    }

    if (error || !scene) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <Card className="p-8 max-w-md text-center">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
                    <h1 className="text-2xl font-bold mb-2">Scene Not Available</h1>
                    <p className="text-muted-foreground mb-6">
                        {error || 'The requested AR scene could not be found.'}
                    </p>
                    <Link href="/dashboard/enterprise">
                        <Button>Return to Dashboard</Button>
                    </Link>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
            {/* Overlay UI */}
            <div className="absolute top-0 left-0 right-0 p-4 z-10 flex justify-between items-start bg-linear-to-b from-black/50 to-transparent">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/enterprise">
                        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                            <ArrowLeft className="h-6 w-6" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold">{scene.name}</h1>
                        <p className="text-sm text-slate-300 opacity-90">{scene.description}</p>
                    </div>
                </div>
                <Badge variant="outline" className="border-white/20 text-white bg-white/10 uppercase">
                    {scene.type}
                </Badge>
            </div>

            {/* AR Content Placeholder - In a real app, this would be <a-scene> */}
            <div className="flex flex-col items-center justify-center h-screen">
                <div className="relative w-full max-w-3xl aspect-video bg-slate-900 rounded-xl border border-slate-800 flex flex-col items-center justify-center p-8 text-center shadow-2xl">
                    <div className="absolute inset-0 bg-grid-white/[0.05] bg-size-[32px_32px]" />
                    <div className="relative z-10">
                        <Box className="h-24 w-24 mx-auto mb-6 text-indigo-500 animate-pulse" />
                        <h2 className="text-3xl font-bold mb-4 bg-clip-text text-transparent bg-linear-to-r from-indigo-400 to-cyan-400">
                            AR View Mode
                        </h2>
                        <p className="text-lg text-slate-400 max-w-lg mx-auto mb-8">
                            This is a simulation of the Augmented Reality view.
                            On a compatible device, this would activate the camera and overlay the
                            <strong> {(() => {
                                const cfg = scene.config as unknown as Record<string, unknown> | undefined;
                                return typeof cfg?.visualizationType === 'string' ? cfg.visualizationType : '3D Model';
                            })()}</strong> data.
                        </p>

                        <div className="flex gap-4 justify-center">
                            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700">
                                Activate Camera
                            </Button>
                            <Button size="lg" variant="outline" className="border-slate-700 text-white hover:bg-slate-800">
                                Calibrate Sensors
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="mt-8 text-slate-500 text-sm">
                    Powered by Real-Time Pulse AR Engine
                </div>
            </div>
        </div>
    );
}
