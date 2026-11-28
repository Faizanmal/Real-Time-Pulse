export interface VerifiedFact {
  label: string;
  value: number;
  unit: string;
  sourceReference: string;
}

export interface BriefingVerification {
  supported: boolean;
  unsupportedNumbers: string[];
  unsupportedSentences: string[];
}

export function redactPii(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted email]')
    .replace(/(?:\+?\d[\d ().-]{7,}\d)/g, '[redacted phone]');
}

/** Numeric text is accepted only when its rounded value is present in source facts. */
export function verifyNumericClaims(text: string, facts: VerifiedFact[]): BriefingVerification {
  const safeText = redactPii(text).trim();
  const numbers = safeText.match(/\$?\b\d[\d,]*(?:\.\d+)?\s*%?/g) ?? [];
  const unsupportedNumbers = numbers.filter((token) => {
    const value = Number(String(token).replace(/[$,%\s,]/g, ''));
    return !facts.some((fact) => {
      const candidates = [fact.value, Number(fact.value.toFixed(1)), Number(fact.value.toFixed(2))];
      return candidates.some((candidate) => Math.abs(candidate - value) < 0.000001);
    });
  });
  const canonical = summaryForFacts(facts);
  const canonicalSentences = new Set(
    canonical.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean),
  );
  const unsupportedSentences = safeText
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .filter(
      (sentence) => !canonicalSentences.has(sentence) && !sentence.startsWith('Human note (unverified):'),
    );
  return {
    supported: unsupportedNumbers.length === 0 && unsupportedSentences.length === 0,
    unsupportedNumbers,
    unsupportedSentences,
  };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function summaryForFacts(facts: VerifiedFact[]): string {
  if (!facts.length) return 'Not enough verified data to report an outcome.';
  return 'Verified source facts are listed below. No forecast or causal attribution is implied.';
}
