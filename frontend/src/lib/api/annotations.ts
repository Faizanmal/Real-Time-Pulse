import { apiClient } from '../api';

export enum AnnotationType {
    COMMENT = 'COMMENT',
    PIN = 'PIN',
    FLAG = 'FLAG',
    ALERT = 'ALERT',
    SUCCESS = 'SUCCESS',
    INFO = 'INFO',
}

export interface Annotation {
    id: string;
    portalId: string;
    widgetId?: string;
    author: {
        id: string;
        firstName?: string;
        lastName?: string;
        avatar?: string;
    };
    content: string;
    type: AnnotationType;
    positionX: number;
    positionY: number;
    dataPoint?: any;
    resolved: boolean;
    createdAt: string;
    replies: Annotation[];
}

export const annotationsApi = {
    getByPortal: async (portalId: string): Promise<Annotation[]> => {
        const response = await apiClient.get(`/annotations/${portalId}`);
        return response.data;
    },

    create: async (data: {
        portalId: string;
        widgetId?: string;
        content: string;
        type: AnnotationType;
        positionX: number;
        positionY: number;
        dataPoint?: any;
    }): Promise<Annotation> => {
        const response = await apiClient.post('/annotations', data);
        return response.data;
    },

    update: async (id: string, data: { content?: string; resolved?: boolean }): Promise<Annotation> => {
        const response = await apiClient.put(`/annotations/${id}`, data);
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/annotations/${id}`);
    },

    reply: async (id: string, content: string): Promise<Annotation> => {
        const response = await apiClient.post(`/annotations/${id}/reply`, { content });
        return response.data;
    },
};
