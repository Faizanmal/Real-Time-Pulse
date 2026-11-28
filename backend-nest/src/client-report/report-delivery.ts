import { createHash } from 'node:crypto';

import PDFDocument from 'pdfkit';

export interface ReportFact {
  label: string;
  value: number;
  unit: string;
  sourceReference: string;
}

export interface ReportSnapshot {
  reportId: string;
  version: number;
  title: string;
  clientName: string;
  reportType: string;
  executiveSummary: string;
  facts: ReportFact[];
  asOf: string | null;
  approvedAt: string;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export const reportSnapshotDigest = (snapshot: ReportSnapshot) =>
  createHash('sha256').update(canonicalJson(snapshot)).digest('hex');

export function escapeReportHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

export function reportEmail(snapshot: ReportSnapshot): { html: string; text: string } {
  const facts = snapshot.facts.length
    ? `<table><caption>Verified metrics, revision ${snapshot.version}</caption><thead><tr><th scope="col">Metric</th><th scope="col">Value</th><th scope="col">Source</th></tr></thead><tbody>${snapshot.facts.map((fact) => `<tr><th scope="row">${escapeReportHtml(fact.label)}</th><td>${fact.value} ${escapeReportHtml(fact.unit)}</td><td>${escapeReportHtml(fact.sourceReference)}</td></tr>`).join('')}</tbody></table>`
    : '<p>Not enough verified data for numeric outcomes.</p>';
  const html = `<main><h1>${escapeReportHtml(snapshot.title)}</h1><p>Prepared for ${escapeReportHtml(snapshot.clientName)} · ${escapeReportHtml(snapshot.reportType)} report · revision ${snapshot.version}</p><p>${escapeReportHtml(snapshot.executiveSummary)}</p>${facts}<p>Data as of: ${escapeReportHtml(snapshot.asOf ?? 'Not available')}</p><p>Approved: ${escapeReportHtml(snapshot.approvedAt)}</p></main>`;
  const text = [snapshot.title, `For ${snapshot.clientName} · revision ${snapshot.version}`, snapshot.executiveSummary,
    ...snapshot.facts.map((fact) => `${fact.label}: ${fact.value} ${fact.unit} (Source: ${fact.sourceReference})`),
    `Data as of: ${snapshot.asOf ?? 'Not available'}`, `Approved: ${snapshot.approvedAt}`].join('\n\n');
  return { html, text };
}

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

export function reportCsv(snapshot: ReportSnapshot): Buffer {
  const rows = [
    ['Report', snapshot.title], ['Client', snapshot.clientName], ['Type', snapshot.reportType],
    ['Revision', snapshot.version], ['Summary', snapshot.executiveSummary], ['Data as of', snapshot.asOf ?? 'Not available'],
    ['Approved at', snapshot.approvedAt], [], ['Metric', 'Value', 'Unit', 'Source'],
    ...snapshot.facts.map((fact) => [fact.label, fact.value, fact.unit, fact.sourceReference]),
  ];
  return Buffer.from(rows.map((row) => row.map((cell) => csvCell(cell ?? '')).join(',')).join('\r\n'), 'utf8');
}

export async function reportPdf(snapshot: ReportSnapshot): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ margin: 48, info: { Title: snapshot.title, Subject: `Approved report revision ${snapshot.version}` } });
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
    document.fontSize(20).text(snapshot.title);
    document.fontSize(11).text(`Prepared for ${snapshot.clientName} · ${snapshot.reportType} · revision ${snapshot.version}`);
    document.moveDown().fontSize(12).text(snapshot.executiveSummary);
    document.moveDown().fontSize(15).text('Verified metrics');
    if (!snapshot.facts.length) document.fontSize(10).text('Not enough verified data for numeric outcomes.');
    for (const fact of snapshot.facts) {
      document.moveDown(0.5).fontSize(11).text(`${fact.label}: ${fact.value} ${fact.unit}`);
      document.fontSize(9).fillColor('#555555').text(`Source: ${fact.sourceReference}`).fillColor('#000000');
    }
    document.moveDown().fontSize(9).text(`Data as of: ${snapshot.asOf ?? 'Not available'}`);
    document.text(`Approved: ${snapshot.approvedAt}`);
    document.end();
  });
}
