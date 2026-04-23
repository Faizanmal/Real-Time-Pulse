export interface MLModel {
  id: string;
  name: string;
  description: string;
  category:
    | 'forecasting'
    | 'anomaly_detection'
    | 'classification'
    | 'clustering'
    | 'nlp'
    | 'recommendation';
  version: string;
  author: string;
  isPublic: boolean;
  isPremium: boolean;
  price?: number;
  rating: number;
  downloads: number;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  config: Record<string, any>;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}
