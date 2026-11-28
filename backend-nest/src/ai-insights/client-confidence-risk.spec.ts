import {
  binaryClassificationMetrics,
  evaluateClientConfidenceRisk,
} from './client-confidence-risk';

describe('client confidence rule evaluation', () => {
  const now = new Date('2026-11-26T12:00:00.000Z');
  const recent = new Date('2026-11-26T10:00:00.000Z');
  const stale = new Date('2026-11-24T10:00:00.000Z');

  it('keeps missing values missing and reports no configured feeds as a driver', () => {
    expect(evaluateClientConfidenceRisk({ feeds: [], now })).toMatchObject({
      level: 'ELEVATED',
      drivers: [{ code: 'SOURCE_MISSING' }],
    });
  });

  it('detects stale data, expired connectors, conflicting sources, and contradictory client status', () => {
    const result = evaluateClientConfidenceRisk({
      now,
      clientStatus: 'ON_TRACK',
      feeds: [
        {
          source: 'Fictional Analytics',
          connectorStatus: 'EXPIRED',
          connectionState: 'NEEDS_RECONNECT',
          lastValidDataAt: stale,
          health: 'STALE',
        },
        { source: 'Fictional CRM', lastValidDataAt: recent, health: 'CURRENT' },
      ],
    });
    expect(result.level).toBe('HIGH');
    expect(result.drivers.map((driver) => driver.code)).toEqual([
      'CONNECTOR_EXPIRED',
      'SOURCE_STALE',
      'SOURCES_CONFLICT',
    ]);
    expect(result.drivers.every((driver) => driver.evidence.length > 0)).toBe(true);
  });

  it('uses the 24 hour age rule to detect status contradictions and does not invent a risk on current sources', () => {
    expect(
      evaluateClientConfidenceRisk({
        clientStatus: 'COMPLETED',
        feeds: [{ source: 'Fixture', lastValidDataAt: stale }],
        now,
      }).drivers,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'SOURCE_STALE' }),
        expect.objectContaining({ code: 'STATUS_CONTRADICTION' }),
      ]),
    );
    expect(
      evaluateClientConfidenceRisk({ feeds: [{ source: 'Fixture', lastValidDataAt: recent }], now })
        .level,
    ).toBe('LOW');
  });

  it('reports synthetic labeled precision and recall without treating it as historical calibration', () => {
    const fixtures = [
      {
        expectedRisk: true,
        detectedRisk: evaluateClientConfidenceRisk({ feeds: [], now }).level !== 'LOW',
      },
      {
        expectedRisk: true,
        detectedRisk:
          evaluateClientConfidenceRisk({
            feeds: [{ source: 'Expired fixture', connectorStatus: 'EXPIRED' }],
            now,
          }).level !== 'LOW',
      },
      {
        expectedRisk: true,
        detectedRisk:
          evaluateClientConfidenceRisk({
            feeds: [{ source: 'Stale fixture', lastValidDataAt: stale }],
            now,
          }).level !== 'LOW',
      },
      {
        expectedRisk: false,
        detectedRisk:
          evaluateClientConfidenceRisk({
            feeds: [{ source: 'Healthy fixture', lastValidDataAt: recent }],
            now,
          }).level !== 'LOW',
      },
    ];
    expect(binaryClassificationMetrics(fixtures)).toEqual({
      truePositive: 3,
      falsePositive: 0,
      falseNegative: 0,
      trueNegative: 1,
      precision: 1,
      recall: 1,
    });
  });
});
