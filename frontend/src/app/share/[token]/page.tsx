"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ClientPortalSummary } from "@/components/client-portal/ClientPortalSummary";
import { ValueClaims } from "@/components/client-portal/ValueClaims";
import { shareLinksApi } from "@/lib/enterprise-api";
import type { PublicValueClaim } from "@/types";

const ClientDecisionPanel = dynamic(
  () => import("@/components/client-portal/ClientDecisionPanel").then((module) => module.ClientDecisionPanel),
  { loading: () => <section aria-busy="true" className="mt-8 min-h-24 rounded-lg border p-4">Loading decisions…</section> },
);
const SharedClientReportsPanel = dynamic(
  () => import("@/components/client-portal/SharedClientReportsPanel").then((module) => module.SharedClientReportsPanel),
  { loading: () => <section aria-busy="true" className="mt-8 min-h-24 rounded-lg border p-4">Loading shared reports…</section> },
);

interface SharedPortal {
  id: string;
  name: string;
  description?: string | null;
  widgets: Array<{
    id: string;
    name: string;
    type: string;
    data: {
      metrics?: Array<{
        key: string;
        label: string;
        value: number | string;
        unit?: string;
      }>;
    } | null;
    sourceLabel: string;
    isDemo: boolean;
  }>;
  clientStatus?: string | null;
  clientStatusNote?: string | null;
  latestDeliverable?: string | null;
  pendingDecision?: string | null;
  clientUpdateAt?: string | null;
  feedStatus?: {
    health: "CURRENT" | "STALE" | "ATTENTION" | "NO_DATA";
    lastSyncedAt: string | null;
    lastValidDataAt: string | null;
    sourceCount: number;
  };
  workspace: { name: string; logo?: string; primaryColor: string };
  metrics?: Array<{
    id: string;
    name: string;
    value: string | null;
    unit: string;
    source: string;
    timeRange: { start: string; end: string; timeZone: string } | null;
    lastUpdatedAt: string | null;
    sourceFreshnessAt: string | null;
    health: string;
    quality: string;
    confidence: string | null;
    calculation: string;
    limitations: unknown;
    sources?: Array<{ externalId: string; updatedAt: string | null }>;
  }>;
  valueClaims?: PublicValueClaim[];
}
interface SharedComment {
  id: string;
  displayName: string;
  content: string;
  createdAt: string;
}

function responseMessage(error: unknown): string {
  const candidate = error as {
    response?: { status?: number; data?: { message?: string | string[] } };
  };
  const message = candidate.response?.data?.message;
  if (Array.isArray(message)) return message.join(". ");
  return (
    message ||
    "We could not open this link. Ask the agency to verify it or send a new link."
  );
}

function responseStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } }).response?.status;
}

export default function SharedPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [checking, setChecking] = useState(true);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState("");
  const [portal, setPortal] = useState<SharedPortal | null>(null);
  const [error, setError] = useState("");
  const [isExpired, setIsExpired] = useState(false);
  const [linkUnavailable, setLinkUnavailable] = useState(false);
  const [assignedOnly, setAssignedOnly] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [permissions, setPermissions] = useState({
    allowExport: false,
    allowComments: false,
    allowDecisions: false,
  });
  const [comments, setComments] = useState<SharedComment[]>([]);
  const [commentName, setCommentName] = useState("");
  const [commentText, setCommentText] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [requestSent, setRequestSent] = useState(false);
  const [actionError, setActionError] = useState("");

  const checkLink = useCallback(async () => {
    setChecking(true);
    setError("");
    setIsExpired(false);
    setLinkUnavailable(false);
    setAssignedOnly(false);
    setPortal(null);
    try {
      const state = await shareLinksApi.check(token);
      setPasswordRequired(state.passwordRequired);
    } catch (reason) {
      const message = responseMessage(reason);
      setError(message);
      const expired = /expired|view limit|deactivated/i.test(message);
      setIsExpired(expired);
      setLinkUnavailable(true);
      setAssignedOnly(/assigned client accounts/i.test(message));
    } finally {
      setChecking(false);
    }
  }, [token]);

  useEffect(() => {
    void checkLink();
  }, [checkLink]);

  const openPortal = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await shareLinksApi.access(token, password || undefined);
      setPortal(result.portal);
      setPermissions(result.permissions);
      if (result.permissions.allowComments)
        setComments(
          await shareLinksApi.listPublicComments(token, password || undefined),
        );
    } catch (reason) {
      setError(responseMessage(reason));
      const message = responseMessage(reason);
      const expiredOrRevoked = /expired|view limit|deactivated/i.test(message);
      setIsExpired(expiredOrRevoked);
      const assignedOnlyDenied = /assigned client accounts/i.test(message);
      setLinkUnavailable(
        expiredOrRevoked ||
          assignedOnlyDenied ||
          responseStatus(reason) === 404,
      );
      setAssignedOnly(assignedOnlyDenied);
    } finally {
      setSubmitting(false);
    }
  };

  const submitComment = async (event: React.FormEvent) => {
    event.preventDefault();
    setActionError("");
    try {
      await shareLinksApi.addPublicComment(token, {
        password: password || undefined,
        displayName: commentName,
        content: commentText,
      });
      setCommentText("");
      setComments(
        await shareLinksApi.listPublicComments(token, password || undefined),
      );
    } catch (reason) {
      setActionError(responseMessage(reason));
    }
  };

  const downloadExport = async () => {
    setActionError("");
    try {
      const data = await shareLinksApi.exportPublicPortal(
        token,
        password || undefined,
      );
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "shared-portal.json";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setActionError(responseMessage(reason));
    }
  };

  const submitAccessRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setActionError("");
    try {
      await shareLinksApi.requestAccess(token, {
        email: requestEmail,
        message: requestMessage,
      });
      setRequestSent(true);
    } catch (reason) {
      setActionError(responseMessage(reason));
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-950">
      <section className="mx-auto max-w-3xl rounded-2xl border bg-white p-6 shadow-sm sm:p-10">
        {checking ? (
          <div role="status" aria-busy="true">
            Checking this secure link…
          </div>
        ) : portal ? (
          <>
            <p className="text-sm text-slate-500">{portal.workspace.name}</p>
            <h1 className="mt-2 text-3xl font-bold">{portal.name}</h1>
            {portal.description && (
              <p className="mt-3 text-slate-600">{portal.description}</p>
            )}
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
                className="mt-8 rounded-lg border p-4"
              >
                <h2 className="font-semibold">Client KPIs</h2>
                <p className="mt-2 text-sm text-slate-600">
                  No canonical client metrics have been shared for this portal.
                </p>
              </section>
            )}
            {(portal.metrics?.length ?? 0) > 0 && (
              <section
                aria-label="Client KPI metrics"
                className="mt-8 space-y-4"
              >
                <h2 className="text-xl font-semibold">Client KPIs</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {portal.metrics!.map((metric) => (
                    <article key={metric.id} className="rounded-lg border p-4">
                      <div className="flex justify-between gap-3">
                        <h3 className="font-medium">{metric.name}</h3>
                        <span className="text-xs">
                          {metric.health === "STALE"
                            ? "Stale feed"
                            : metric.health}{" "}
                          · {metric.quality}
                        </span>
                      </div>
                      <p className="mt-2 text-2xl font-semibold">
                        {metric.value === null
                          ? "Unavailable"
                          : `${metric.value} ${metric.unit}`}
                      </p>
                      <dl className="mt-3 space-y-1 text-xs text-slate-500">
                        <div>Source: {metric.source}</div>
                        <div>
                          Period:{" "}
                          {metric.timeRange
                            ? `${new Date(metric.timeRange.start).toLocaleString()} – ${new Date(metric.timeRange.end).toLocaleString()} (${metric.timeRange.timeZone})`
                            : "No snapshot yet"}
                        </div>
                        <div>Calculation: {metric.calculation}</div>
                        <div>
                          Completeness confidence:{" "}
                          {metric.confidence ?? "Not assessed"} (heuristic, not
                          statistical)
                        </div>
                        <div>
                          Last calculated:{" "}
                          {metric.lastUpdatedAt
                            ? new Date(metric.lastUpdatedAt).toLocaleString()
                            : "Not calculated"}
                        </div>
                        <div>
                          Source freshness:{" "}
                          {metric.sourceFreshnessAt
                            ? new Date(
                                metric.sourceFreshnessAt,
                              ).toLocaleString()
                            : "No successful sync"}
                        </div>
                      </dl>
                      {Array.isArray(metric.limitations) &&
                        metric.limitations.length > 0 && (
                          <p className="mt-2 text-xs text-amber-700">
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
            {portal.widgets.length === 0 ? (
              <p className="mt-8 rounded-lg border p-5 text-slate-600">
                This shared portal has no visible widgets.
              </p>
            ) : (
              <ul className="mt-8 divide-y rounded-lg border">
                {portal.widgets.map((widget) => (
                  <li className="p-4" key={widget.id}>
                    <span className="font-medium">{widget.name}</span>
                    <span className="ml-2 text-sm text-slate-500">
                      {widget.type}
                    </span>
                    {widget.data?.metrics?.length ? (
                      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                        {widget.data.metrics.map((metric) => (
                          <li
                            key={metric.key}
                            className="rounded bg-slate-50 p-3"
                          >
                            <span className="block text-sm text-slate-500">
                              {metric.label}
                            </span>
                            <strong>
                              {metric.value}
                              {metric.unit === "USD"
                                ? " USD"
                                : metric.unit
                                  ? ` ${metric.unit}`
                                  : ""}
                            </strong>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">
                        {widget.sourceLabel}
                      </p>
                    )}
                    {widget.isDemo && (
                      <small className="mt-2 block text-xs text-slate-500">
                        Fictional local sample data — not live.
                      </small>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {permissions.allowExport && (
              <button
                type="button"
                onClick={() => void downloadExport()}
                className="mt-6 rounded-lg border px-4 py-2"
              >
                Download shared data
              </button>
            )}
            {permissions.allowComments && (
              <section className="mt-8 border-t pt-6">
                <h2 className="text-xl font-semibold">Comments</h2>
                {comments.length === 0 ? (
                  <p className="mt-2 text-slate-600">No comments yet.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {comments.map((comment) => (
                      <li key={comment.id} className="rounded border p-3">
                        <strong>{comment.displayName}</strong>
                        <p>{comment.content}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <form onSubmit={submitComment} className="mt-4 space-y-3">
                  <label className="block text-sm">
                    Your name
                    <input
                      className="mt-1 block w-full rounded border px-3 py-2"
                      maxLength={80}
                      required
                      value={commentName}
                      onChange={(e) => setCommentName(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm">
                    Comment
                    <textarea
                      className="mt-1 block w-full rounded border px-3 py-2"
                      maxLength={2000}
                      required
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                    />
                  </label>
                  <button className="rounded-lg bg-slate-900 px-4 py-2 text-white">
                    Post comment
                  </button>
                </form>
              </section>
            )}
            {permissions.allowDecisions && <ClientDecisionPanel token={token} password={password || undefined} />}
            {permissions.allowExport && <SharedClientReportsPanel token={token} password={password || undefined} />}
            {actionError && (
              <p role="alert" className="mt-4 text-red-700">
                {actionError}
              </p>
            )}
          </>
        ) : linkUnavailable ? (
          <>
            <h1 className="text-2xl font-semibold">
              {isExpired
                ? "This link is no longer available"
                : "Access to this link is unavailable"}
            </h1>
            <p role="alert" className="mt-3 text-slate-600">
              {error}
            </p>
            <p className="mt-4 text-sm text-slate-500">
              Ask your agency contact to review access or share a current link.
            </p>
            {assignedOnly && (
              <Link
                className="mt-3 inline-block rounded bg-slate-900 px-4 py-2 text-white"
                href={`/auth/login?returnTo=${encodeURIComponent(`/share/${token}`)}`}
              >
                Sign in with your client account
              </Link>
            )}
            {requestSent ? (
              <p role="status" className="mt-4">
                If this link can be matched, the agency will review your
                request.
              </p>
            ) : (
              <form onSubmit={submitAccessRequest} className="mt-5 space-y-3">
                <label className="block text-sm">
                  Email for the agency to reply to
                  <input
                    className="mt-1 block w-full rounded border px-3 py-2"
                    type="email"
                    required
                    value={requestEmail}
                    onChange={(e) => setRequestEmail(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  Message (optional)
                  <textarea
                    className="mt-1 block w-full rounded border px-3 py-2"
                    maxLength={1000}
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                  />
                </label>
                {actionError && (
                  <p role="alert" className="text-red-700">
                    {actionError}
                  </p>
                )}
                <button className="rounded-lg border px-4 py-2">
                  Request access
                </button>
              </form>
            )}
            <button
              type="button"
              onClick={() => void checkLink()}
              className="mt-6 rounded-lg border px-4 py-2"
            >
              Check again
            </button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold">Open shared portal</h1>
            <p className="mt-2 text-slate-600">
              {passwordRequired
                ? "Enter the password supplied by your agency contact."
                : "Continue to view the portal shared with you."}
            </p>
            <form onSubmit={openPortal} className="mt-6 space-y-4">
              {passwordRequired && (
                <label className="block text-sm font-medium">
                  Password
                  <input
                    className="mt-2 block w-full rounded-md border px-3 py-2"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </label>
              )}
              {error && (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
              >
                {submitting ? "Opening…" : "Open portal"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
