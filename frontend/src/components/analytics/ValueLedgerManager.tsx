"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { analyticsApi, type ValueLedgerEntry } from "@/lib/api/analytics";
import { portalsApi } from "@/lib/api/portals";

type PortalOption = { id: string; name: string };

export function ValueLedgerManager() {
  const [portals, setPortals] = useState<PortalOption[]>([]);
  const [portalId, setPortalId] = useState("");
  const [entries, setEntries] = useState<ValueLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [shareWhenApproved, setShareWhenApproved] = useState(false);
  const [title, setTitle] = useState("Monthly time-saved estimate");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [hours, setHours] = useState({ low: "", base: "", high: "" });
  const [rate, setRate] = useState({ low: "", base: "", high: "" });
  const [hoursNote, setHoursNote] = useState("");
  const [rateNote, setRateNote] = useState("");

  const load = useCallback(
    async (selectedPortalId?: string) => {
      setError("");
      try {
        const portalResponse = await portalsApi.getPortals(1, 100);
        const options = portalResponse.portals.map(({ id, name }) => ({
          id,
          name,
        }));
        setPortals(options);
        const selected = selectedPortalId || portalId || options[0]?.id || "";
        setPortalId(selected);
        setEntries(selected ? await analyticsApi.getValueLedger(selected) : []);
      } catch {
        setError("Value ledger could not be loaded. Check access and retry.");
      } finally {
        setLoading(false);
      }
    },
    [portalId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function saveDraft(event: React.FormEvent) {
    event.preventDefault();
    if (
      !portalId ||
      !hoursNote.trim() ||
      !rateNote.trim() ||
      !periodStart ||
      !periodEnd
    ) {
      setError("Add a period and human evidence note for both assumptions.");
      return;
    }
    const numbers = [...Object.values(hours), ...Object.values(rate)].map(
      Number,
    );
    if (numbers.some((number) => !Number.isFinite(number))) {
      setError("Enter finite low, base and high values for both assumptions.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const latestRevision = Math.max(
        0,
        ...entries.map((entry) => entry.revision),
      );
      await analyticsApi.createValueLedgerDraft({
        portalId,
        expectedRevision: latestRevision,
        title,
        periodStart: new Date(periodStart).toISOString(),
        periodEnd: new Date(periodEnd).toISOString(),
        timeZone: "UTC",
        hoursSaved: {
          low: Number(hours.low),
          base: Number(hours.base),
          high: Number(hours.high),
          evidence: {
            kind: "HUMAN_NOTE",
            label: "Hours saved assumption",
            note: hoursNote,
          },
        },
        loadedHourlyRate: {
          low: Number(rate.low),
          base: Number(rate.base),
          high: Number(rate.high),
          evidence: {
            kind: "HUMAN_NOTE",
            label: "Loaded hourly rate assumption",
            note: rateNote,
          },
        },
      });
      toast.success("Draft value claim added as a new revision");
      setHoursNote("");
      setRateNote("");
      await load(portalId);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Draft claim could not be saved. Refresh and retry.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function approve(entry: ValueLedgerEntry) {
    try {
      await analyticsApi.approveValueLedgerEntry(
        entry.id,
        entry.revision,
        shareWhenApproved,
      );
      toast.success(
        shareWhenApproved
          ? "Approved and included in the client packet"
          : "Claim approved for agency use",
      );
      await load(portalId);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Claim approval failed. Refresh to resolve stale state.",
      );
    }
  }

  async function exportPacket() {
    if (!portalId) return;
    try {
      const blob = await analyticsApi.exportValueLedger(portalId);
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `client-value-packet-${portalId}.json`;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch {
      setError(
        "Client value packet could not be exported. Retry after checking portal access.",
      );
    }
  }

  if (loading)
    return (
      <section aria-busy="true" className="rounded-xl border p-6">
        <p>Loading proof-of-value ledger…</p>
      </section>
    );

  return (
    <section
      aria-labelledby="value-ledger-heading"
      className="space-y-5 rounded-xl border p-5 sm:p-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="value-ledger-heading" className="text-xl font-semibold">
            Proof-of-value ledger
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Transparent time-saved estimate: hours saved × loaded hourly rate.
            Low/base/high values are assumptions, not generated ROI, confidence
            intervals, or proof of causality. Every revision keeps its own
            evidence and approval history.
          </p>
        </div>
        <button
          type="button"
          disabled={!portalId}
          onClick={() => void exportPacket()}
          className="rounded border px-3 py-2 text-sm disabled:opacity-50"
        >
          Export client packet (JSON)
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900"
        >
          {error}
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => {
              setLoading(true);
              void load(portalId);
            }}
          >
            Retry
          </button>
        </div>
      )}
      {!portals.length ? (
        <p className="rounded-lg bg-muted p-4">
          Create a client portal before adding a value claim.
        </p>
      ) : (
        <>
          <label className="block max-w-xl text-sm">
            Client portal
            <select
              aria-label="Value ledger client portal"
              value={portalId}
              onChange={(event) => {
                setLoading(true);
                void load(event.target.value);
              }}
              className="mt-1 block w-full rounded border bg-background p-2"
            >
              {portals.map((portal) => (
                <option key={portal.id} value={portal.id}>
                  {portal.name}
                </option>
              ))}
            </select>
          </label>

          <form
            onSubmit={saveDraft}
            className="space-y-4 rounded-lg bg-muted/40 p-4"
          >
            <h3 className="font-medium">Add a new draft revision</h3>
            <label className="block text-sm">
              Claim title
              <input
                required
                maxLength={160}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-1 block w-full rounded border bg-background p-2"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                Period start
                <input
                  required
                  type="date"
                  value={periodStart}
                  onChange={(event) => setPeriodStart(event.target.value)}
                  className="mt-1 block w-full rounded border bg-background p-2"
                />
              </label>
              <label className="text-sm">
                Period end
                <input
                  required
                  type="date"
                  value={periodEnd}
                  onChange={(event) => setPeriodEnd(event.target.value)}
                  className="mt-1 block w-full rounded border bg-background p-2"
                />
              </label>
              <label className="text-sm">
                Time zone
                <input
                  readOnly
                  value="UTC"
                  className="mt-1 block w-full rounded border bg-muted p-2"
                />
              </label>
            </div>
            <RangeFields
              title="Hours saved per period"
              unit="hours"
              values={hours}
              onChange={setHours}
            />
            <label className="block text-sm">
              Evidence note for hours assumption
              <textarea
                required
                maxLength={500}
                value={hoursNote}
                onChange={(event) => setHoursNote(event.target.value)}
                className="mt-1 block w-full rounded border bg-background p-2"
                placeholder="Fictional example: estimate reviewed with client on 2026-10-30"
              />
            </label>
            <RangeFields
              title="Loaded hourly rate"
              unit="USD/hour"
              values={rate}
              onChange={setRate}
            />
            <label className="block text-sm">
              Evidence note for rate assumption
              <textarea
                required
                maxLength={500}
                value={rateNote}
                onChange={(event) => setRateNote(event.target.value)}
                className="mt-1 block w-full rounded border bg-background p-2"
                placeholder="Fictional example: client-approved blended rate card"
              />
            </label>
            <button
              type="submit"
              disabled={saving || !portalId}
              className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Saving draft…" : "Save draft revision"}
            </button>
          </form>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={shareWhenApproved}
              onChange={(event) => setShareWhenApproved(event.target.checked)}
            />
            Include newly approved claims in the next published client packet
          </label>
          <div className="space-y-3">
            <h3 className="font-medium">Revision history</h3>
            {!entries.length ? (
              <p className="rounded-lg bg-muted p-4">
                No value claims yet. Draft claims are private until approved and
                explicitly shared.
              </p>
            ) : (
              entries.map((entry) => (
                <article key={entry.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <h4 className="font-medium">
                        {entry.title} · revision {entry.revision}
                      </h4>
                      <p className="text-sm">
                        {entry.resultValue} {entry.unit} ·{" "}
                        {entry.sensitivity.low}–{entry.sensitivity.high}{" "}
                        {entry.unit} · {entry.sensitivity.formula}
                      </p>
                    </div>
                    <span className="text-sm">
                      {entry.status}
                      {entry.clientVisible
                        ? " · client visible"
                        : " · agency only"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Entered by {entry.createdByLabel} on{" "}
                    {new Date(entry.createdAt).toLocaleString()} ·{" "}
                    {new Date(entry.periodStart).toLocaleDateString()}–
                    {new Date(entry.periodEnd).toLocaleDateString()} (
                    {entry.timeZone})
                  </p>
                  {entry.status === "DRAFT" && (
                    <button
                      type="button"
                      onClick={() => void approve(entry)}
                      className="mt-3 rounded border px-3 py-2 text-sm"
                    >
                      Approve{shareWhenApproved ? " and share" : ""}
                    </button>
                  )}
                </article>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}

function RangeFields({
  title,
  unit,
  values,
  onChange,
}: {
  title: string;
  unit: string;
  values: { low: string; base: string; high: string };
  onChange: (values: { low: string; base: string; high: string }) => void;
}) {
  return (
    <fieldset className="rounded border p-3">
      <legend className="px-1 text-sm font-medium">
        {title} ({unit})
      </legend>
      <div className="grid gap-3 sm:grid-cols-3">
        {(["low", "base", "high"] as const).map((key) => (
          <label key={key} className="text-sm">
            {key[0].toUpperCase() + key.slice(1)}
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={values[key]}
              onChange={(event) =>
                onChange({ ...values, [key]: event.target.value })
              }
              className="mt-1 block w-full rounded border bg-background p-2"
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
