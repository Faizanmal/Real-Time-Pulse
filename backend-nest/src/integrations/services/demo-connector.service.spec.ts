import { DEMO_CONNECTOR_LABEL, DemoConnectorService } from './demo-connector.service';

describe('DemoConnectorService', () => {
  const service = new DemoConnectorService();

  it('marks every metric payload as fictional and returns deterministic sample values', () => {
    const first = service.fetchData('metrics');
    const second = service.fetchData('metrics');

    expect(first).toEqual(second);
    expect(first.isDemo).toBe(true);
    expect(first.sourceLabel).toBe(DEMO_CONNECTOR_LABEL);
    expect(first.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'monthly_revenue', value: 42850, unit: 'USD' }),
    ]));
  });

  it('has no external provider credentials in settings', () => {
    expect(service.getSettings()).toEqual({
      isDemo: true,
      sourceLabel: DEMO_CONNECTOR_LABEL,
      datasetName: 'Northstar Demo Studio sample',
      datasetVersion: 1,
    });
  });
});
