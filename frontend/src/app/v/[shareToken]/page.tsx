"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useCallback, useEffect, useState } from "react";

import { ClientPortalSummary } from "@/components/client-portal/ClientPortalSummary";
import { ValueClaims } from "@/components/client-portal/ValueClaims";
import { portalApi } from "@/lib/api-client";
import type { PublicPortalView } from "@/types";

function formatMetric(value: number, unit: string): string {
  if (unit === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }
  if (unit === "%") return `${value}%`;
  if (unit === "of 15") return `${value} of 15`;
  return `${value} ${unit}`;
}

export default function ClientPortalPageRoute() {
  return (
    <Suspense
      fallback={
        <main aria-busy="true" className="mx-auto max-w-5xl p-8">
          <p>Loading client portal…</p>
        </main>
      }
    >
      <ClientPortalPage />
    </Suspense>
  );
}

function ClientPortalPage() {
  const params = useParams<{ shareToken: string }>();
  const searchParams = useSearchParams();
  const shareToken = params.shareToken;
  const previewPortalId = searchParams.get("previewPortalId");
  const [portal, setPortal] = useState<PublicPortalView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewAccessIssue, setPreviewAccessIssue] = useState<
    "sign-in" | "forbidden" | null
  >(null);

  const loadPortal = useCallback(async () => {
    setIsLoading(true);
    setError("");
    setPreviewAccessIssue(null);
    try {
      setPortal(
        previewPortalId
          ? await portalApi.previewDraft(previewPortalId)
          : await portalApi.getClientView(shareToken),
      );
    } catch (reason) {
      setPortal(null);
      const status = (reason as { response?: { status?: number } }).response
        ?.status;
      if (previewPortalId && status === 401) {
        setPreviewAccessIssue("sign-in");
        setError("Sign in with an agency account to preview this portal.");
      } else if (previewPortalId && status === 403) {
        setPreviewAccessIssue("forbidden");
        setError(
          "Your account does not have permission to preview this portal.",
        );
      } else {
        setError(
          "This client portal is unavailable. Ask the agency to check the share link and visibility.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [shareToken, previewPortalId]);

  useEffect(() => {
    void loadPortal();
  }, [loadPortal]);

  if (isLoading) {
    return (
      <main role="status" aria-busy="true" className="mx-auto max-w-5xl p-8">
        <p>Loading client portal…</p>
      </main>
    );
  }

  if (!portal) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-2xl font-semibold">Client portal unavailable</h1>
        <p role="alert" className="mt-3 text-slate-600">
          {error}
        </p>
        {previewAccessIssue === "sign-in" && (
          <a
            className="mt-4 inline-block rounded-lg border px-4 py-2"
            href={`/auth/login?returnTo=${encodeURIComponent(`/v/preview?previewPortalId=${previewPortalId}`)}`}
          >
            Sign in to continue
          </a>
        )}
        {previewAccessIssue === "forbidden" && (
          <p className="mt-3 text-sm">
            Ask your agency administrator to grant preview access.
          </p>
        )}
        <button
          type="button"
          onClick={() => void loadPortal()}
          className="mt-5 rounded-lg border px-4 py-2"
        >
          Retry
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 dark:bg-slate-950 dark:text-white">
      <div className="mx-auto max-w-5xl">
        {portal.viewMode === "draft-preview" && (
          <aside
            role="status"
            className="mb-6 rounded-xl border border-blue-300 bg-blue-50 p-4 text-blue-950"
          >
            Client permission preview of the current draft. Private notes,
            connector credentials, and agency controls are excluded.
          </aside>
        )}
        <header className="mb-8">
          <p className="text-sm font-medium text-slate-500">
            {portal.workspaceName}
          </p>
          <h1 className="mt-1 text-3xl font-bold">{portal.name}</h1>
          {portal.description && (
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              {portal.description.replace(/^\[REAL_TIME_PULSE_DEMO\]\s*/, "")}
            </p>
          )}
        </header>

        <ClientPortalSummary
          status={portal.clientStatus ?? null}
          statusNote={portal.clientStatusNote ?? null}
          latestDeliverable={portal.latestDeliverable ?? null}
          pendingDecision={portal.pendingDecision ?? null}
          updatedAt={portal.clientUpdateAt ?? null}
          feedStatus={portal.feedStatus}
        />
        <ValueClaims claims={portal.valueClaims} />

        {!portal.metrics?.length && (
          <section
            aria-label="Client KPI metrics"
            className="mb-8 rounded-xl border p-5"
          >
            <h2 className="font-semibold">Client KPIs</h2>
            <p className="mt-2 text-sm text-slate-600">
              No canonical client metrics have been shared for this portal.
            </p>
          </section>
        )}
        {(portal.metrics?.length ?? 0) > 0 && (
          <section aria-label="Client KPI metrics" className="mb-8 space-y-4">
            <h2 className="text-xl font-semibold">Client KPIs</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {portal.metrics!.map((metric) => (
                <article
                  key={metric.id}
                  className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex justify-between gap-3">
                    <h3 className="font-semibold">{metric.name}</h3>
                    <span className="text-xs">
                      {metric.health === "STALE" ? "Stale feed" : metric.health}{" "}
                      · {metric.quality}
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-bold">
                    {metric.value === null
                      ? "Unavailable"
                      : `${metric.value} ${metric.unit}`}
                  </p>
                  <dl className="mt-3 space-y-1 text-xs text-slate-500">
                    <div>
                      <dt className="inline">Source: </dt>
                      <dd className="inline">{metric.source}</dd>
                    </div>
                    <div>
                      <dt className="inline">Period: </dt>
                      <dd className="inline">
                        {metric.timeRange
                          ? `${new Date(metric.timeRange.start).toLocaleString()} – ${new Date(metric.timeRange.end).toLocaleString()} (${metric.timeRange.timeZone})`
                          : "No snapshot yet"}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline">Calculation: </dt>
                      <dd className="inline">{metric.calculation}</dd>
                    </div>
                    <div>
                      <dt className="inline">Completeness confidence: </dt>
                      <dd className="inline">
                        {metric.confidence ?? "Not assessed"} (heuristic, not
                        statistical)
                      </dd>
                    </div>
                    <div>
                      <dt className="inline">Last calculated: </dt>
                      <dd className="inline">
                        {metric.lastUpdatedAt
                          ? new Date(metric.lastUpdatedAt).toLocaleString()
                          : "Not calculated"}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline">Source freshness: </dt>
                      <dd className="inline">
                        {metric.sourceFreshnessAt
                          ? new Date(metric.sourceFreshnessAt).toLocaleString()
                          : "No successful sync"}
                      </dd>
                    </div>
                  </dl>
                  {Array.isArray(metric.limitations) &&
                    metric.limitations.length > 0 && (
                      <p className="mt-3 text-xs text-amber-700">
                        {metric.limitations.join("; ")}
                      </p>
                    )}
                  {metric.sources?.length ? (
                    <details className="mt-3 text-xs">
                      <summary className="cursor-pointer">
                        Permitted source records ({metric.sources.length})
                      </summary>
                      <ul className="mt-2 list-disc pl-5">
                        {metric.sources.map((source) => (
                          <li key={source.externalId}>
                            {source.externalId}
                            {source.updatedAt
                              ? ` · ${new Date(source.updatedAt).toLocaleString()}`
                              : ""}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        )}

        <section
          aria-label="Sample data notice"
          className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <strong>Fictional demo data — not live provider metrics.</strong>
          <p className="mt-1 text-sm">
            The Demo Connector uses a fixed local dataset. No external provider
            account was contacted.
          </p>
        </section>

        {portal.widgets.length === 0 ? (
          <p className="rounded-xl border p-6 text-slate-600">
            This portal has no widgets yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
            {portal.widgets.map((widget) => (
              <section
                key={widget.id}
                data-testid={`client-widget-${widget.id}`}
                className={`col-span-1 rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${widget.layout?.w === 12 ? "md:col-span-12" : widget.layout?.w && widget.layout.w >= 6 ? "md:col-span-6" : "md:col-span-4"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold">{widget.name}</h2>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
                    {widget.isDemo ? "Demo sample" : "No public data"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {widget.sourceLabel}
                </p>
                {widget.data?.metrics?.length ? (
                  <dl className="mt-5 grid grid-cols-2 gap-4">
                    {widget.data.metrics.map((metric) => (
                      <div
                        key={metric.key}
                        className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"
                      >
                        <dt className="text-sm text-slate-600 dark:text-slate-300">
                          {metric.label}
                        </dt>
                        <dd className="mt-1 text-2xl font-semibold">
                          {formatMetric(metric.value, metric.unit)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p
                    role={widget.isDemo ? "alert" : undefined}
                    className="mt-5 text-sm text-slate-500"
                  >
                    {widget.isDemo
                      ? widget.sourceLabel
                      : "No public sample metrics are configured for this widget."}
                  </p>
                )}
                {widget.data?.asOfDate && (
                  <p className="mt-4 text-xs text-slate-500">
                    Sample dataset date: {widget.data.asOfDate}
                  </p>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
