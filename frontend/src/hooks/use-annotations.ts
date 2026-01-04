import { useState, useCallback, useEffect } from "react";
import { annotationsApi, Annotation as ApiAnnotation, AnnotationType as ApiAnnotationType } from "@/lib/api/annotations";
import type { Annotation, AnnotationType } from "@/components/ui/data-annotations";
import { useSocket, useSocketEvent } from "@/contexts/socket-context";

// Mapper function to convert Backend API format to Frontend Component format
const mapToComponentAnnotation = (a: ApiAnnotation): Annotation => ({
    id: a.id,
    type: a.type.toLowerCase() as AnnotationType,
    content: a.content,
    author: {
        id: a.author.id,
        name: a.author.firstName ? `${a.author.firstName} ${a.author.lastName}` : "Unknown User",
        avatar: a.author.avatar
    },
    position: { x: a.positionX, y: a.positionY },
    timestamp: new Date(a.createdAt),
    resolved: a.resolved,
    // Recursively map replies if they exist
    replies: a.replies?.map(r => ({
        id: r.id,
        content: r.content,
        author: {
            id: r.author.id,
            name: r.author.firstName ? `${r.author.firstName} ${r.author.lastName}` : "Unknown User",
            avatar: r.author.avatar
        },
        timestamp: new Date(r.createdAt)
    })) || [],
    dataPoint: a.dataPoint // Assuming structure matches or is passed through
});

export function useAnnotations(portalId: string) {
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { joinPortal, leavePortal, isConnected } = useSocket();

    // Socket Room Management
    useEffect(() => {
        if (portalId && isConnected) {
            joinPortal(portalId);
            return () => leavePortal(portalId);
        }
    }, [portalId, isConnected, joinPortal, leavePortal]);

    // Socket Listeners
    useSocketEvent('annotation:created', (data: ApiAnnotation) => {
        if (data.portalId === portalId) {
            setAnnotations(prev => {
                if (prev.some(p => p.id === data.id)) return prev;
                return [...prev, mapToComponentAnnotation(data)];
            });
        }
    });

    useSocketEvent('annotation:updated', (data: ApiAnnotation) => {
        if (data.portalId === portalId) {
            setAnnotations(prev => prev.map(a => a.id === data.id ? mapToComponentAnnotation(data) : a));
        }
    });

    useSocketEvent('annotation:deleted', (data: { id: string }) => {
        setAnnotations(prev => prev.filter(a => a.id !== data.id));
    });

    useSocketEvent('annotation:reply_added', (data: any) => {
        // Backend payload: { parentId, reply }
        const { parentId, reply: replyData } = data;
        if (replyData && replyData.portalId === portalId && parentId) {
            const reply = mapToComponentAnnotation(replyData);

            setAnnotations(prev => prev.map(a =>
                a.id === parentId
                    ? { ...a, replies: [...(a.replies || []).filter(r => r.id !== reply.id), reply] }
                    : a
            ));
        }
    });

    const fetchAnnotations = useCallback(async () => {
        if (!portalId) return;
        try {
            setLoading(true);
            const data = await annotationsApi.getByPortal(portalId);
            setAnnotations(data.map(mapToComponentAnnotation));
            setError(null);
        } catch (err) {
            console.error("Failed to fetch annotations:", err);
            setError("Failed to load annotations");
        } finally {
            setLoading(false);
        }
    }, [portalId]);

    useEffect(() => {
        fetchAnnotations();
    }, [fetchAnnotations]);

    const addAnnotation = async (data: { x: number; y: number; type: AnnotationType; content: string; dataPoint?: any }) => {
        try {
            const apiType = data.type.toUpperCase() as ApiAnnotationType;
            const newAnnotation = await annotationsApi.create({
                portalId,
                positionX: data.x,
                positionY: data.y,
                type: apiType,
                content: data.content,
                dataPoint: data.dataPoint
            });
            const mapped = mapToComponentAnnotation(newAnnotation);
            setAnnotations(prev => [...prev, mapped]);
            return mapped;
        } catch (err) {
            console.error("Failed to create annotation:", err);
            throw err;
        }
    };

    const updateAnnotation = async (id: string, updates: Partial<Annotation>) => {
        try {
            // Optimistic update
            setAnnotations(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));

            await annotationsApi.update(id, {
                content: updates.content,
                resolved: updates.resolved
            });
        } catch (err) {
            console.error("Failed to update annotation:", err);
            // Revert on error would be ideal, but skipping for brevity
            fetchAnnotations();
        }
    };

    const deleteAnnotation = async (id: string) => {
        try {
            setAnnotations(prev => prev.filter(a => a.id !== id));
            await annotationsApi.delete(id);
        } catch (err) {
            console.error("Failed to delete annotation:", err);
            fetchAnnotations();
        }
    };

    const replyToAnnotation = async (parentId: string, content: string) => {
        try {
            const reply = await annotationsApi.reply(parentId, content);
            // API returns the newly created reply object (which is a comment)
            // We need to fetch/refresh because we need the parent structure update (or manually append)
            // Let's manually append for UI responsiveness
            // But we need to map the reply to AnnotationReply format
            // The reply object from API is a full annotation

            /* 
               We need to know the structure of `reply` from API. 
               It is `Annotation`.
            */
            const mappedReply = {
                id: reply.id,
                content: reply.content,
                author: {
                    id: reply.author.id,
                    name: reply.author.firstName ? `${reply.author.firstName} ${reply.author.lastName}` : "Unknown",
                    avatar: reply.author.avatar
                },
                timestamp: new Date(reply.createdAt)
            };

            setAnnotations(prev => prev.map(a =>
                a.id === parentId
                    ? { ...a, replies: [...(a.replies || []), mappedReply] }
                    : a
            ));

        } catch (err) {
            console.error("Failed to reply:", err);
        }
    };

    return {
        annotations,
        loading,
        error,
        addAnnotation,
        updateAnnotation,
        deleteAnnotation,
        replyToAnnotation,
        refresh: fetchAnnotations
    };
}
