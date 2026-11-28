"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { analyticsApi, type ProductAnalyticsSummary } from "@/lib/api/analytics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function formatMoney(amount: number, currency: string): string {
  const value = amount.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  return `${currency} ${value || "0"}`;
}

export function ProductAnalyticsPanel() {
  const [summary, setSummary] = useState<ProductAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const panelEventSent = useRef(false);
  const sendPanelEvent = (kind: "FEATURE_ADOPTION" | "FEATURE_SUCCESS" | "FEATURE_GUARDRAIL", eventName: string) => {
    if (typeof crypto === "undefined" || !crypto.randomUUID) return;
    void analyticsApi.recordProductEvent({
      eventId: crypto.randomUUID(),
      featureKey: "product_analytics",
      kind,
      eventName,
    }).catch(() => undefined);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await analyticsApi.getProductAnalytics(30));
      if (!panelEventSent.current) {
        panelEventSent.current = true;
        sendPanelEvent("FEATURE_ADOPTION", "panel_viewed");
      }
    } catch {
      setError("Product analytics could not be loaded. Check workspace access and retry.");
      sendPanelEvent("FEATURE_GUARDRAIL", "dashboard_load_failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const exportResults = async () => {
    setExporting(true);
    try {
      const blob = await analyticsApi.exportExperimentResults(30);
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = "experiment-results.csv";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(href), 1000);
      sendPanelEvent("FEATURE_SUCCESS", "experiment_results_exported");
      toast.success("Experiment results exported");
    } catch {
      toast.error("Experiment results could not be exported. Retry after checking workspace access.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card role="region" aria-labelledby="product-analytics-title">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle id="product-analytics-title">Feature use and operating cost</CardTitle>
          <CardDescription>
            Last 30 days · observed charges and estimates are reported separately · no customer content is stored
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
          <Button variant="outline" onClick={() => void exportResults()} disabled={exporting}>
            {exporting ? "Exporting…" : "Export experiment results"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && !summary ? (
          <p role="status" className="py-6 text-sm text-muted-foreground">Loading product analytics…</p>
        ) : error ? (
          <div role="alert" className="space-y-3 py-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" onClick={() => void load()}>Retry</Button>
          </div>
        ) : !summary || (summary.features.length === 0 && summary.experiments.length === 0) ? (
          <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            No product events have been recorded in this workspace during the last 30 days. The dashboard will show feature adoption, success, guardrails and cost after instrumented events arrive.
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-xs text-muted-foreground">
              Generated {new Date(summary.generatedAt).toLocaleString()}
              {summary.lastEventAt ? ` · latest event ${new Date(summary.lastEventAt).toLocaleString()}` : " · no events in range"}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <caption className="sr-only">Feature adoption, outcomes, guardrails and operating costs over the last 30 days</caption>
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th scope="col" className="py-2 pr-4">Feature</th>
                    <th scope="col" className="px-2 py-2">Adoption</th>
                    <th scope="col" className="px-2 py-2">Success</th>
                    <th scope="col" className="px-2 py-2">Guardrails</th>
                    <th scope="col" className="px-2 py-2">Measured usage</th>
                    <th scope="col" className="px-2 py-2">Observed cost</th>
                    <th scope="col" className="px-2 py-2">Estimated cost</th>
                    <th scope="col" className="px-2 py-2">Last event</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.features.map((feature) => (
                    <tr key={feature.featureKey} className="border-b last:border-0">
                      <th scope="row" className="py-3 pr-4 font-medium">{feature.featureKey}</th>
                      <td className="px-2 py-3">{feature.adoptionEvents.toLocaleString()}</td>
                      <td className="px-2 py-3">{feature.successEvents.toLocaleString()}</td>
                      <td className="px-2 py-3">{feature.guardrailEvents.toLocaleString()}</td>
                      <td className="px-2 py-3">{feature.usage.map((item) => `${item.category} ${item.quantity.toLocaleString()} ${item.unit}`).join(", ") || "—"}</td>
                      <td className="px-2 py-3">{feature.costs.filter((cost) => cost.basis === "OBSERVED").map((cost) => `${cost.category} ${formatMoney(cost.amount, cost.currency)}`).join(", ") || "—"}</td>
                      <td className="px-2 py-3">{feature.costs.filter((cost) => cost.basis === "ESTIMATED").map((cost) => `${cost.category} ${formatMoney(cost.amount, cost.currency)}`).join(", ") || "—"}</td>
                      <td className="px-2 py-3 text-xs text-muted-foreground">{feature.latestEventAt ? new Date(feature.latestEventAt).toLocaleString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <section aria-labelledby="experiment-results-title" className="space-y-2">
              <h3 id="experiment-results-title" className="font-semibold">Experiment results</h3>
              {summary.experiments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No experiment measurements have been recorded in this period.</p>
              ) : (
                <ul className="grid gap-2 md:grid-cols-2">
                  {summary.experiments.map((experiment) => (
                    <li key={`${experiment.experimentKey}:${experiment.variantKey}:${experiment.metric}`} className="rounded-md border p-3 text-sm">
                      <p className="font-medium">{experiment.experimentKey} · {experiment.variantKey}</p>
                      <p>{experiment.metric}: mean {experiment.mean.toLocaleString()} from {experiment.samples.toLocaleString()} samples</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
