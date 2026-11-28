# Phase 24 — Performance and scale

**Status: BLOCKED for Core Web Vitals validation; route JavaScript budgets PASS.** A reproducible production-mode route transfer benchmark completed in an isolated Linux container. Mobile portal and dashboard are under their configured budgets. Browser LCP/INP/CLS and end-user/device measurements remain unverified, so this is not a full Core Web Vitals pass.

## Existing state and evidence

- The mobile client view is a client component and requests its public projection after hydration: `frontend/src/app/v/[shareToken]/page.tsx:1,25-35,51-85`. It renders explicit loading, error/retry and empty-metric states at `:87-123,160-169`.
- The separate password/capability share page already checks the link before showing content and gates decisions and reports by the returned permissions: `frontend/src/app/share/[token]/page.tsx:110-163,217-224,429-430`.
- The dense agency dashboard fetches portals, workspace, integrations and attention in parallel, then requests workspace stats afterward: `frontend/src/app/dashboard/page.tsx:89-135`. Portal cards are paginated to 20 records (API call at `:104-106`) but each displayed card previously had its own animated `motion.div` wrapper at `:891-916`.
- All routes, including public client views, are wrapped in the shared query/auth/feature-flag/socket/notification/presence providers: `frontend/src/app/layout.tsx:103-126`, `frontend/src/app/providers.tsx:65-92`. This remains a potential global JavaScript and initialization cost requiring a wider, separately measured change.
- Public portal reads are selected by unique share token plus `deletedAt: null` and `isPublic: true`, and project only the published snapshot: `backend-nest/src/portals/portal.service.ts:211-249`. That read path does not use the portal cache. Existing cache keys are based on globally unique portal IDs (`backend-nest/src/cache/cache.service.ts:44-48`); this phase adds no cache behavior.

## Scoped plan and design / ADR

1. Defer the larger client decision and shared-report client modules until the server-authorized link permissions enable them. Keep their existing components and their own loading/error/retry behavior. Reserve a visible loading area while their JavaScript loads.
2. Remove the per-card Framer Motion wrapper from the already paginated dashboard list. Keep the portal-card actions, checkbox selection and pagination unchanged.
3. Remove the custom single all-node_modules vendor split, which defeated route-level sharing; add a local production route budget from initial HTML script assets. Budgets are 300 KiB for the portal and 500 KiB for dashboard. This transfer-size guard does not substitute for browser/field LCP, INP or CLS.
4. Make no schema, service, API, realtime event, provider, cache, or production setting changes. No new data is stored, and no migration or backfill is required.

This follows the installed Next.js 16 lazy-loading guidance in `frontend/node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`: `next/dynamic` defers Client Component modules until rendered. It preserves the server permission gate as the decision point; loading a component chunk never grants permission or data access.

## Modified files

- `frontend/src/app/share/[token]/page.tsx` — dynamically imports decision and report panels, only rendered under the existing permission conditions, with reserved loading states.
- `frontend/src/app/dashboard/page.tsx` — removes staggered animation wrappers around each paginated portal card.
- `frontend/scripts/perf-budget.mjs` — reads rendered route script tags and sums raw/per-asset gzip sizes; exits nonzero when over budget or build output is unavailable.
- `frontend/package.json` — adds `npm run perf:budget` (the file already contained unrelated workspace edits before this phase).
- `frontend/next.config.ts` — removes the all-dependencies custom vendor chunk override; supports isolated benchmark output directory and standalone packaging toggle.
- `docs/agent-execution/24-performance-scale.md` — this report.

## Migration notes

No database or API contract changed. There is no migration, backfill, dual-write, rollout flag, or contract transition. Reverting the frontend split/import/animation and benchmark changes restores the prior eager imports and per-card animation; it does not touch data or external services.

## API and UI contracts

- API/event: unchanged. Portal reads, share-link permission checks, comments, decisions, exports and report reads retain their current endpoints and payloads.
- Client UI: a public share link still shows its primary snapshot content and existing state handling. Decision/report panels are fetched as JavaScript only if `allowDecisions` / `allowExport` is true; a brief `aria-busy` reserved placeholder appears while that code is loading. Component API failures continue to use the panels' existing error and retry UI.
- Agency UI: up to the current page of portals is still rendered and searchable/selectable. Only per-card entrance animation was removed.
- Budget: `cd frontend; npm run build -- --webpack; npm run perf:budget`. The script starts built Next, fetches `/v/fictional-performance-share` and `/dashboard`, extracts initial HTML script assets and reports raw and individually gzip-compressed bytes; it fails above 300 KiB / 500 KiB. Next 16 does not emit the old `app-build-manifest.json`, so measurement uses rendered HTML.

## Checks and actual results

- `cd frontend; npm run typecheck` — **exit 0**.
- Targeted ESLint with existing `react-hooks/set-state-in-effect` rule overridden — **exit 0**; ordinary targeted lint previously surfaced that existing rule and an import-order issue, which was corrected.
- Historical Windows host build attempts — **exit 1**, `EPERM` creating nested `.next` paths. Retained as environment-specific evidence.
- Isolated Linux production build (Next 16.4.6, fictional route token, standalone packaging disabled) — **exit 0**, all 63 routes generated.
- Reproducible baseline build restoring eager panel imports, per-card animation and prior all-node_modules vendor split — **exit 0**. Mobile portal: **2,180,697 raw / 683,009 gzip bytes** (307,200-byte budget, FAIL). Agency dashboard: **2,246,289 raw / 698,404 gzip bytes** (512,000-byte budget, FAIL).
- Post-change same-container build — **exit 0**. `npm run perf:budget` — **exit 0**: portal, 12 initial script files, **739,352 raw / 229,106 gzip bytes** (PASS); dashboard, 26 files, **1,111,903 raw / 349,471 gzip bytes** (PASS). Gzip transfer fell 453,903 bytes (66.4%) and 348,933 bytes (50.0%), respectively. These measure initial route scripts, not Core Web Vitals.
- `cd e2e; npm run test:smoke -- --grep "agency creates persistent client portal and other workspace remains denied"` — **exit 1 before tests**, Docker port binding/engine constraints; no browser assertions ran.
- Browser LCP/INP/CLS and interaction latency — **NOT MEASURED**. Do not infer field metrics from script bytes.

## Manual smoke steps

1. On a machine where Docker Desktop's Linux engine is available, run the isolated E2E command above with the test-only `pulse_test` database and Redis ports. Use only the fictional Northstar/Juniper fixtures.
2. Run the frontend production build, then `npm run perf:budget`. Save output from both a pre-change checkout/worktree and this change; compare the two route byte totals. Do not substitute dev-server values for production values.
3. Start the production build and open a published client portal at 390 × 844 with mobile throttling. Record LCP, CLS and one interaction latency; verify the initial portal, loading/error/retry behavior and explicit empty KPI message.
4. Open the password-protected share route with `allowDecisions=false` and `allowExport=false`; confirm those chunks are not requested and their content/endpoints are inaccessible. Repeat with each permission enabled and verify panel loading, API failure and retry.
5. Open the dense agency dashboard with 20 fictional portals; verify pagination, filtering, selection, portal navigation and delete actions. Compare first load, long-task/interaction latency, and CLS with the baseline.

## Security and tenant review

- The lazy modules are rendered only behind the existing permission flags set by the share-link access response. Browser-side flags are presentation controls; existing API authorization remains authoritative.
- This change adds no browser, server or shared response cache. Public projections remain addressed by the opaque share token; private dashboard APIs remain authenticated and workspace-scoped. No cross-tenant cache key or cache collision path is introduced.
- No overload behavior changed because no backend work or data caching was added. Existing API errors remain visible; quantitative load shedding/capacity behavior was not benchmarked.
- Existing portal/share-link authorization and tenant regression tests are present in the repository, but their browser run is blocked as recorded above.

## Data privacy

No new telemetry, cookies, storage, identifiers, or third-party requests are introduced. The budget script reads local page HTML and generated JavaScript assets only. Test account and fixture names are fictional and use `.invalid` domains; no provider keys or live records are needed.

## Capacity and cost estimate

This is a client bundle/rendering change with no added API calls, background jobs, database rows, provider usage or server cache. **Incremental server/database/provider capacity and recurring cost are estimated at zero**, assuming unchanged request volume and deployment footprint. For planning only, assume the existing app tier remains at 2 vCPU / 4 GiB per application instance with the current managed Postgres and Redis services unchanged; this is not verified deployment inventory. No actual user concurrency, asset bytes, CDN rate, or production traffic baseline was available, so bandwidth/client CPU savings are unquantified. Method: after a successful production build, the script measures route JavaScript bytes and individually gzip-compressed transfer size; the manual browser comparison should use a 390 × 844 Chrome mobile viewport throttled to 4× CPU and 1.6 Mbps down / 150 ms RTT, plus the same dashboard scenario on desktop. A defensible capacity estimate beyond zero added server work requires those measurements plus verified hardware, traffic and egress prices.

## Rollback

Revert the dynamic imports, card wrapper change, package script and measurement script. This restores the previous client chunk loading and visual entrance animations. No data or schema rollback is needed. Do not remove any existing `.next` output as part of rollback.

## Unverified assumptions and status

- The paired production script benchmark measured lower initial route script transfer: portal 683,009 to 229,106 gzip bytes; dashboard 698,404 to 349,471 gzip bytes.
- Removing per-card animation wrappers reduces per-item animation setup, but dashboard main-thread and interaction improvements are unmeasured.
- The 300 KiB / 500 KiB gzip budgets are engineering guardrails; the measured current bundles pass. Representative devices still require review.
- The full acceptance criteria for representative browser Core Web Vitals and browser smoke have not been demonstrated. **Phase 24 remains BLOCKED.**

## Exactly what must happen before the next phase

Run browser-based mobile/dashboard smoke and representative LCP/INP/CLS plus interaction measurements in a supported CI/host environment, and run targeted Playwright smoke against the disposable test stack. Retain before/after outputs and keep both budgets green. Phase 24 stays **BLOCKED** until those browser metrics and tests are recorded.
