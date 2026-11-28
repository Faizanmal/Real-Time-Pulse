import { Injectable } from '@nestjs/common';

export const DEMO_CONNECTOR_LABEL = 'Real-Time Pulse Demo Connector';

const DEMO_METRICS = [
  { key: 'monthly_revenue', label: 'Monthly revenue', value: 42850, unit: 'USD' },
  { key: 'active_clients', label: 'Active clients', value: 18, unit: 'clients' },
  { key: 'projects_on_track', label: 'Projects on track', value: 12, unit: 'of 15' },
  { key: 'on_time_delivery', label: 'On-time delivery', value: 94.6, unit: '%' },
];

@Injectable()
export class DemoConnectorService {
  getSettings(): Record<string, unknown> {
    return {
      isDemo: true,
      sourceLabel: DEMO_CONNECTOR_LABEL,
      datasetName: 'Northstar Demo Studio sample',
      datasetVersion: 1,
    };
  }

  fetchData(dataType: string) {
    return {
      isDemo: true,
      sourceLabel: DEMO_CONNECTOR_LABEL,
      datasetName: 'Northstar Demo Studio sample',
      asOfDate: '2026-11-23',
      dataType,
      metrics: DEMO_METRICS.map((metric) => ({ ...metric })),
    };
  }
}
