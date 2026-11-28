"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  analyticsApi,
  type CanonicalMetricDefinition,
  type CanonicalMetricMapping,
} from "@/lib/api/analytics";
import { portalsApi } from "@/lib/api/portals";
import { integrationApi } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth";

type PortalOption = { id: string; name: string };
type IntegrationOption = { id: string; provider: string; name?: string };

export function MetricMappingManager() {
  const { user } = useAuthStore();
  const workspaceId = user?.workspaceId;
  const [catalog, setCatalog] = useState<CanonicalMetricDefinition[]>([]);
  const [mappings, setMappings] = useState<CanonicalMetricMapping[]>([]);
  const [portals, setPortals] = useState<PortalOption[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationOption[]>([]);
  const [portalId, setPortalId] = useState("");
  const [integrationId, setIntegrationId] = useState("");
  const [definitionId, setDefinitionId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [clientVisible, setClientVisible] = useState(false);
  const [allowDrilldown, setAllowDrilldown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const [definitionRows, mappingRows, portalRows, integrationRows] =
        await Promise.all([
          analyticsApi.getMetricCatalog(),
          analyticsApi.getMetricMappings(),
          portalsApi.getPortals(1, 100),
          integrationApi.getAllByWorkspace(workspaceId),
        ]);
      setCatalog(definitionRows);
      setMappings(mappingRows);
      setPortals(portalRows.portals.map(({ id, name }) => ({ id, name })));
      setIntegrations(
        integrationRows.map(({ id, provider }) => ({
          id,
          provider,
          name: provider,
        })),
      );
      setPortalId((current) => current || portalRows.portals[0]?.id || "");
      setDefinitionId((current) => current || definitionRows[0]?.id || "");
      setIntegrationId(
        (current) =>
          current ||
          integrationRows.find(
            (item) => item.provider === definitionRows[0]?.provider,
          )?.id ||
          "",
      );
    } catch {
      setError(
        "Metrics could not be loaded. Check your workspace access and retry.",
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = () => {
    setLoading(true);
    setError("");
    void load();
  };

  const selectedDefinition = catalog.find(
    (definition) => definition.id === definitionId,
  );
  const compatibleIntegrations = integrations.filter(
    (integration) => integration.provider === selectedDefinition?.provider,
  );

  async function saveMapping(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await analyticsApi.createMetricMapping({
        portalId,
        integrationId,
        metricDefinitionId: definitionId,
        displayName,
        clientVisible,
        allowSourceDrilldown: clientVisible && allowDrilldown,
      });
      setDisplayName("");
      toast.success("Client metric mapping saved");
      await load();
    } catch {
      toast.error(
        "Metric mapping was not saved. Verify the portal, provider and metric selections.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function addMilestone(mapping: CanonicalMetricMapping) {
    const name = window.prompt(`Milestone name for ${mapping.displayName}`);
    const target = window.prompt(
      `Target value (${mapping.metricDefinition.unit})`,
    );
    const targetDate = window.prompt("Target date (YYYY-MM-DD)");
    if (!name || !target || !targetDate) return;
    try {
      await analyticsApi.createMilestone(mapping.id, {
        name,
        targetValue: Number(target),
        targetDate,
      });
      toast.success("Milestone added");
      await load();
    } catch {
      toast.error("Milestone could not be saved");
    }
  }

  async function reprocess(mapping: CanonicalMetricMapping) {
    const reason = window.prompt("Reason for this audited data repair");
    if (!reason) return;
    try {
      await analyticsApi.reprocessMetric(mapping.id, reason);
      toast.success("Metric reprocessed");
      await load();
    } catch {
      toast.error("Metric reprocessing failed; the run is recorded for review");
    }
  }

  if (loading)
    return (
      <section aria-busy="true" className="rounded-xl border p-6">
        <p>Loading metric catalog and client mappings…</p>
      </section>
    );
  if (error)
    return (
      <section className="rounded-xl border p-6">
        <p role="alert">{error}</p>
        <button
          className="mt-3 rounded border px-3 py-2"
          onClick={refresh}
        >
          Retry
        </button>
      </section>
    );

  return (
    <section
      className="space-y-5 rounded-xl border p-6"
      aria-labelledby="metric-mapping-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="metric-mapping-title" className="text-xl font-semibold">
            Canonical client metrics
          </h2>
          <p className="text-sm text-muted-foreground">
            Choose a client portal, compatible provider source and versioned
            metric. Missing values remain unavailable; they are never filled
            with zero.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="rounded border px-3 py-2 text-sm"
        >
          Refresh metrics
        </button>
      </div>
      {portals.length === 0 ? (
        <p className="rounded-lg bg-muted p-4">
          Create a client portal before mapping KPIs.
        </p>
      ) : catalog.length === 0 ? (
        <p className="rounded-lg bg-muted p-4">
          No supported metrics are available for this workspace yet.
        </p>
      ) : (
        <form onSubmit={saveMapping} className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Client portal
            <select
              required
              value={portalId}
              onChange={(event) => setPortalId(event.target.value)}
              className="mt-1 block w-full rounded border bg-background p-2"
            >
              {portals.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Metric
            <select
              required
              value={definitionId}
              onChange={(event) => {
                setDefinitionId(event.target.value);
                setIntegrationId("");
              }}
              className="mt-1 block w-full rounded border bg-background p-2"
            >
              {catalog.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.unit} · {item.aggregation}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Provider account
            <select
              required
              value={integrationId}
              onChange={(event) => setIntegrationId(event.target.value)}
              className="mt-1 block w-full rounded border bg-background p-2"
            >
              {compatibleIntegrations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Client label
            <input
              required
              minLength={1}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="mt-1 block w-full rounded border bg-background p-2"
              placeholder={selectedDefinition?.name ?? "e.g. Open issues"}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={clientVisible}
              onChange={(event) => {
                setClientVisible(event.target.checked);
                if (!event.target.checked) setAllowDrilldown(false);
              }}
            />
            Visible to the client
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={!clientVisible}
              checked={allowDrilldown}
              onChange={(event) => setAllowDrilldown(event.target.checked)}
            />
            Allow source record IDs in drilldown
          </label>
          <p className="md:col-span-2 text-xs text-muted-foreground">
            {selectedDefinition?.definition} Source:{" "}
            {selectedDefinition?.provider}; unit: {selectedDefinition?.unit};
            sample period: {selectedDefinition?.samplePeriod}; timezone:{" "}
            {selectedDefinition?.timeZone}; transform v
            {selectedDefinition?.transformVersion}.
          </p>
          <button
            disabled={saving || !portalId || !integrationId || !definitionId}
            className="w-fit rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save client KPI"}
          </button>
        </form>
      )}
      <div className="space-y-3">
        {mappings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No client KPIs are mapped yet.
          </p>
        ) : (
          mappings.map((mapping) => (
            <article key={mapping.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium">
                    {mapping.displayName}{" "}
                    <span className="text-sm text-muted-foreground">
                      · {mapping.portal.name}
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {mapping.metricDefinition.provider} ·{" "}
                    {mapping.metricDefinition.unit} ·{" "}
                    {mapping.metricDefinition.aggregation} · transform v
                    {mapping.metricDefinition.transformVersion} ·{" "}
                    {mapping.clientVisible ? "client visible" : "agency only"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void addMilestone(mapping)}
                    className="rounded border px-3 py-1.5 text-sm"
                  >
                    Add milestone
                  </button>
                  <button
                    onClick={() => void reprocess(mapping)}
                    className="rounded border px-3 py-1.5 text-sm"
                  >
                    Reprocess
                  </button>
                </div>
              </div>
              <p className="mt-2 text-sm">
                Latest: {mapping.latestSnapshot?.value ?? "Unavailable"}{" "}
                {mapping.latestSnapshot?.unit ?? mapping.metricDefinition.unit}{" "}
                · {mapping.latestSnapshot?.quality ?? "MISSING"} · feed{" "}
                {mapping.feedHealth}
                {mapping.latestSnapshot?.confidence
                  ? ` · completeness confidence ${mapping.latestSnapshot.confidence} (heuristic)`
                  : " · confidence not assessed"}
                {mapping.integration.lastSyncedAt
                  ? ` · source synced ${new Date(mapping.integration.lastSyncedAt).toLocaleString()}`
                  : " · no successful source sync"}
                {mapping.latestSnapshot?.calculatedAt
                  ? ` · metric updated ${new Date(mapping.latestSnapshot.calculatedAt).toLocaleString()}`
                  : ""}
              </p>
              {mapping.milestones?.length ? (
                <ul className="mt-2 list-disc pl-5 text-sm">
                  {mapping.milestones.map((milestone) => (
                    <li key={milestone.id}>
                      {milestone.name}: {milestone.targetValue} by{" "}
                      {new Date(milestone.targetDate).toLocaleDateString()} (
                      {milestone.status})
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
