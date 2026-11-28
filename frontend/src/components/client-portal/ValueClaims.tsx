import type { PublicValueClaim } from "@/types";

export function ValueClaims({ claims }: { claims?: PublicValueClaim[] }) {
  if (!claims?.length) return null;
  return (
    <section aria-label="Proof of value" className="mb-8 space-y-4">
      <h2 className="text-xl font-semibold">Proof of value</h2>
      {claims.map((claim) => (
        <article
          key={`${claim.title}-${claim.revision}`}
          className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">{claim.title}</h3>
              <p className="text-xs text-slate-500">
                Approved claim · revision {claim.revision}
              </p>
            </div>
            <strong className="text-xl">
              {claim.value} {claim.unit}
            </strong>
          </div>
          <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium">Formula</dt>
              <dd>
                {claim.calculation} ({claim.formula})
              </dd>
            </div>
            <div>
              <dt className="font-medium">Sensitivity range</dt>
              <dd>
                {claim.sensitivity.low}–{claim.sensitivity.high}{" "}
                {claim.sensitivity.unit}; base {claim.sensitivity.base}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Period</dt>
              <dd>
                {new Date(claim.period.start).toLocaleString()} –{" "}
                {new Date(claim.period.end).toLocaleString()} (
                {claim.period.timeZone})
              </dd>
            </div>
            <div>
              <dt className="font-medium">Approved</dt>
              <dd>
                {claim.approvedBy ?? "Agency approver"} ·{" "}
                {claim.approvedAt
                  ? new Date(claim.approvedAt).toLocaleString()
                  : "date unavailable"}
              </dd>
            </div>
          </dl>
          <h4 className="mt-4 text-sm font-semibold">
            Assumptions and evidence
          </h4>
          <ul className="mt-2 space-y-3 text-sm">
            {Object.entries(claim.assumptions).map(([key, assumption]) => (
              <li
                key={key}
                className="rounded-md bg-slate-50 p-3 dark:bg-slate-800"
              >
                <strong>
                  {key === "hoursSaved"
                    ? "Hours saved"
                    : key === "loadedHourlyRate"
                      ? "Loaded hourly rate"
                      : key}
                </strong>
                : {assumption.low}–{assumption.high} {assumption.unit}; base{" "}
                {assumption.base}.
                <span className="mt-1 block">
                  {assumption.evidence.label}:{" "}
                  {assumption.evidence.kind === "HUMAN_NOTE"
                    ? assumption.evidence.note
                    : assumption.evidence.reference}
                </span>
                <span className="block text-xs text-slate-500">
                  Entered by {assumption.evidence.owner} on{" "}
                  {new Date(assumption.evidence.enteredAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-amber-800 dark:text-amber-200">
            {claim.limitation}
          </p>
        </article>
      ))}
    </section>
  );
}
