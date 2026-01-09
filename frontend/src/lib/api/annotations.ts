import { apiClient } from '../api';

export enum AnnotationType {
    COMMENT = 'COMMENT',
    PIN = 'PIN',
    FLAG = 'FLAG',
    ALERT = 'ALERT',
    SUCCESS = 'SUCCESS',
    INFO = 'INFO',
}

export interface CreateAnnotationDto {
    portalId: string;
    widgetId?: string;
    content: string;
    type: AnnotationType;
    positionX: number;
    positionY: number;
    dataPoint?: Record<string, unknown>;
}

export interface UpdateAnnotationDto {
    content?: string;
    resolved?: boolean;
}

export interface Annotation {
    id: string;
    portalId: string;
    widgetId?: string;
    userId: string;
    author?: {
        id: string;
        firstName?: string;
        lastName?: string;
        avatar?: string;
    };
    content: string;
    type: AnnotationType;
    positionX: number;
    positionY: number;
    dataPoint?: Record<string, unknown>;
    resolved: boolean;
    replies?: Annotation[];
    createdAt: string;
    updatedAt: string;
}

export const annotationsApi = {
    getByPortal: async (portalId: string): Promise<Annotation[]> => {
        const response = await apiClient.get<Annotation[]>(`/annotations/${portalId}`);
        return response.data;
    },

    create: async (data: CreateAnnotationDto): Promise<Annotation> => {
        const response = await apiClient.post<Annotation>('/annotations', data);
        return response.data;
    },

    update: async (id: string, data: { content?: string; resolved?: boolean }): Promise<Annotation> => {
        const response = await apiClient.put<Annotation>(`/annotations/${id}`, data);
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/annotations/${id}`);
    },

    reply: async (id: string, content: string): Promise<Annotation> => {
        const response = await apiClient.post<Annotation>(`/annotations/${id}/reply`, { content });
        return response.data;
    },
};

