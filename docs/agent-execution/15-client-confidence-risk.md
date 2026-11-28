# Phase 15 — Client Confidence Risk

## Existing state and evidence

- `backend-nest/prisma/schema.prisma:1612-1659` already defines `AIInsight` with workspace and portal scope, severity, an untyped `confidence` float, JSON `data`, and mutable status. `AIFeedback` at `1663-1684` is an append-only related feedback record.
- `backend-nest/src/ai-insights/ai-insights.service.ts:85-225` generated fixed widget-count/staleness rules and inserted a new insight each call. Confidence constants such as `.95` were not statistically calibrated. `getPortalInsights` was workspace scoped but excluded dismissed records.
- `backend-nest/src/ai-insights/ai-insights.service.ts:231-251` previously updated dismiss/action by insight ID alone; the authenticated controller supplied no workspace to those mutations (`ai-insights.controller.ts:84-97`).
- `backend-nest/src/portals/client-portal-status.ts:31-55` already summarized visible feed health and the 24-hour stale threshold. Tests covered missing and stale data, but not risk-driver evidence or rule metrics.
- `frontend/src/components/dashboard/AIInsightsPanel.tsx:18-48` loaded insights and swallowed failures. The card showed confidence percentages at lines 185-206, with no calibrated-probability caveat or explainable risk drivers.
- There is no root `AGENTS.md` or `reference/` directory in this checkout. `frontend/AGENTS.md:1-8` required reading installed Next documentation; the installed Next 16 fetching-data and server/client component guides were read before frontend edits.

## Design / ADR

Reuse the existing AI Insights module. Add a deterministic, versioned rule evaluator, not a second risk subsystem or ML model. It returns an ordinal LOW/ELEVATED/HIGH level, at most the top three drivers with supporting source evidence, evaluation time, and rule version. Drivers cover missing data, stale data, expired or unhealthy connectors, conflicting source health, and client-status contradictions. No missing value is converted to zero.

The API queries only a portal in the authenticated user’s workspace, excludes soft-deleted portals, and returns a safe projection without connector credentials. Acknowledgement/action requires a current OWNER or ADMIN row in that workspace, keeps the original insight row, and appends an `AIFeedback` record. Portal insight reads now retain acknowledged/dismissed rows for visible history.

Quality evaluation uses deterministic, fictional labeled fixtures. A binary precision/recall helper reports fixture counts; it does not claim probability calibration or operator utility. Do not enable ML extensions or use this fixture score as a production performance claim until separately consented and labeled historical scenarios and operator outcomes are evaluated.

## Modified files

- `backend-nest/src/ai-insights/client-confidence-risk.ts` — rule evaluator and classification metrics helper.
- `backend-nest/src/ai-insights/client-confidence-risk.spec.ts` — synthetic no-data, stale, conflict, expired connector, contradictory status, healthy, and precision/recall cases.
- `backend-nest/src/ai-insights/ai-insights.controller.ts` — authenticated risk read route; workspace is taken from `CurrentUser`.
- `backend-nest/src/ai-insights/ai-insights.service.ts` — portal-scoped risk projection and role/tenant-scoped acknowledgement, with append-only feedback.
- `backend-nest/src/ai-insights/ai-insights.service.security.spec.ts` — role denial, guessed foreign-tenant ID, acknowledgement audit, and tenant-scoped risk lookup.
- `frontend/src/lib/enterprise-api.ts` — typed risk response/client call.
- `frontend/src/components/dashboard/AIInsightsPanel.tsx` — evidence drivers, evaluation timestamp, uncalibrated-rule disclosure, retryable error copy, and retained acknowledgement status.
- `docs/agent-execution/15-client-confidence-risk.md` — this execution record.

## Migration notes

No Prisma schema or database migration was needed. `AIFeedback` already exists. The API response is additive for risk reads; portal insight reads now include dismissed rows so history remains visible. Older clients can ignore the new route and continue reading the existing insight fields. No database or production settings were changed.

## API and UI contracts

- `GET /api/v1/ai-insights/portal/:portalId/risk` — JWT-authenticated, workspace derived from session. Returns `{ level, drivers: [{ code, title, evidence }], evaluatedAt, ruleVersion }`. Missing/foreign/deleted portal returns not found. No credential, token, private account data, or raw connector payload is included.
- Existing `PATCH /api/v1/ai-insights/:id/dismiss` and `/action` — JWT-authenticated; current OWNER/ADMIN membership in the insight workspace is checked in the service. Both preserve the insight record and append a feedback row; foreign IDs return not found.
- Portal insight reads include dismissed/actioned status so the panel can retain acknowledged history. The panel displays current rule drivers and their evidence, check time, and rule version. It states explicitly that the level is not a calibrated probability. Risk-read errors and insight-read errors have separate alert states; loading and empty states remain available.

## Test commands and output

Commands ran from `backend-nest` or `frontend`; actual exit codes:

| Command | Exit | Result |
| --- | ---: | --- |
| `npm test -- --runInBand src/ai-insights/client-confidence-risk.spec.ts src/ai-insights/ai-insights.service.security.spec.ts src/portals/client-portal-status.spec.ts` | 0 | 3 suites, 13 tests passed. Synthetic labeled fixture results: TP=3, FP=0, FN=0, TN=1; precision=1.0, recall=1.0. |
| `npm run typecheck` (`backend-nest`) | 0 | TypeScript passed. |
| `npm run typecheck` (`frontend`) | 0 | TypeScript passed. |
| `npx eslint src/ai-insights/ai-insights.controller.ts src/ai-insights/ai-insights.service.ts src/ai-insights/client-confidence-risk.ts src/ai-insights/client-confidence-risk.spec.ts src/ai-insights/ai-insights.service.security.spec.ts` (`backend-nest`) | 0 | No findings. |
| `npx eslint src/lib/enterprise-api.ts src/components/dashboard/AIInsightsPanel.tsx` (`frontend`) | 0 | No errors; existing component-length and React effect warnings remain. |
| `git diff --check` | 0 | Clean; Git printed line-ending conversion warnings for unrelated pre-existing modified files. |

An earlier first run of the new tests failed on a timestamp-derived stale/status contradiction case. The rule was corrected, and the final focused run passed. No live provider keys were needed. No external provider calls, DB migration, or deployment were performed.

## Manual smoke steps

1. Run the local API and frontend with the repository’s local environment and sign in as a fictional OWNER/ADMIN in a test workspace.
2. Open a portal containing one healthy recent fixture source and one stale or expired fictional source. Confirm the displayed level, up to three source-specific drivers, evidence text, evaluation time, and rule version.
3. Confirm an empty portal reports missing data rather than a healthy score or zero-filled values. Confirm a current portal reports LOW and no risk drivers.
4. Acknowledge an insight; confirm the item remains visible as acknowledged after reload and its source insight still exists.
5. As a MEMBER, attempt the mutation; confirm JWT/role denial. As another workspace owner, request a guessed portal or insight ID; confirm not found and no mutation.
6. Simulate an API failure and confirm visible alert copy rather than an empty-success state.

Manual browser/API smoke was not run in this turn; these steps remain to be performed against local services.

## Security and tenant review

Portal risk reads use `{ id, workspaceId, deletedAt: null }`; no caller-supplied workspace is accepted. The controller already applies `JwtAuthGuard`, whose policy denies MEMBER access to agency APIs. Acknowledgement additionally queries the current user by `{ id, workspaceId, role in [OWNER, ADMIN] }` and resolves insight by `{ id, workspaceId }` before writing. The regression test covers a non-authorized role and a guessed foreign-tenant ID. The original insight is not deleted; acknowledgement adds feedback.

## Data privacy

Only portal-visible widget names/provider labels, connector state, client status, and freshness timestamps are used. The risk response does not return OAuth tokens, account IDs, raw provider observations, private notes, or connector error text. Test scenarios are fictional and contain no provider credentials or real customer data.

## Rollback

No migration rollback is needed. Revert the new risk route/evaluator/client and UI additions to remove the feature. Keep already appended `AIFeedback` rows and insight status changes; deleting this audit history is not part of rollback. The dismissed-history response behavior can be reverted separately if an older client relies on filtered reads, while retaining the database history.

## Unverified assumptions and status

- The repository contains no consented, labeled historical scenarios or operator outcome dataset. Historical precision/recall, false-positive rate, calibration, and operator utility are therefore unverified. The synthetic fixture result is not representative of live clients.
- Risk labels are ordinal rules, not probabilities; probability calibration is intentionally not reported.
- Local DB/API/browser behavior and deployment-time migration state were not smoke-tested. The implementation is mock/unit-tested; the endpoint’s live database projection needs local smoke validation.
- Rule thresholds (24-hour stale age and contradictory client status) are policy choices and need product-owner review before client-facing production use.

**Status: BLOCKED for full Phase 15 acceptance.** The code path and synthetic rule evaluation are implemented and focused checks pass, but consented historical evaluation, calibrated performance, operator utility, and manual local API/UI smoke remain unverified. Do not extend to ML until those evaluations are completed and reviewed.

## Before the next phase

1. Obtain an approved, consented, tenant-safe historical evaluation set with human-reviewed risk labels and operator outcomes.
2. Measure false positives, precision/recall by scenario and tenant, calibration if a probability is later introduced, and operator utility; document acceptance thresholds with the owner.
3. Run the manual local smoke steps above and capture results, including OWNER/ADMIN denial and foreign-tenant IDs.
4. Only after review of those results should the next phase add ML or expose risk levels to client-facing production surfaces.
