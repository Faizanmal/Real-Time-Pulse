import { reportCsv, reportEmail, reportPdf, reportSnapshotDigest, ReportSnapshot } from './report-delivery';

const fixture: ReportSnapshot = {
  reportId: 'fixture-report-a', version: 2, title: 'Fictional monthly report', clientName: 'Sample Client',
  reportType: 'MONTHLY', executiveSummary: 'Revenue is 120 USD for the sample period.',
  facts: [{ label: 'Revenue', value: 120, unit: 'USD', sourceReference: 'fixture.revenue' }],
  asOf: '2026-10-31T23:59:00.000Z', approvedAt: '2026-11-01T10:00:00.000Z',
};

describe('immutable report delivery formats', () => {
  it('uses the same approved revision, value, and source in email and CSV', async () => {
    const email = reportEmail(fixture);
    const csv = reportCsv(fixture).toString('utf8');
    const pdf = await reportPdf(fixture);
    expect(email.html).toContain('revision 2');
    expect(email.html).toContain('120 USD');
    expect(email.html).toContain('fixture.revenue');
    expect(csv).toContain('"120","USD","fixture.revenue"');
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('escapes HTML and represents missing data without inventing zeroes', () => {
    const empty = { ...fixture, executiveSummary: '<script>bad</script>', facts: [] };
    const email = reportEmail(empty);
    expect(email.html).toContain('&lt;script&gt;bad&lt;/script&gt;');
    expect(email.html).toContain('Not enough verified data');
    expect(email.html).not.toContain('0 USD');
  });

  it('changes the digest only when the immutable snapshot content changes', () => {
    expect(reportSnapshotDigest(fixture)).toBe(reportSnapshotDigest({ ...fixture }));
    expect(reportSnapshotDigest(fixture)).not.toBe(reportSnapshotDigest({ ...fixture, version: 3 }));
    expect(reportSnapshotDigest(fixture)).toBe(reportSnapshotDigest({
      approvedAt: fixture.approvedAt,
      asOf: fixture.asOf,
      clientName: fixture.clientName,
      executiveSummary: fixture.executiveSummary,
      facts: [{ sourceReference: 'fixture.revenue', unit: 'USD', value: 120, label: 'Revenue' }],
      reportId: fixture.reportId,
      reportType: fixture.reportType,
      title: fixture.title,
      version: fixture.version,
    }));
  });
});
