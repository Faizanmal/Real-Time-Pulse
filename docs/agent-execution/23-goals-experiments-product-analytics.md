# Phase 23 — Goals, experiments and product analytics

**Status: BLOCKED for production-ready cost reporting.** The additive schema → service → API → dashboard → CSV workflow is implemented and verified with fictional local events. The repository does not yet have automatic producer hooks that forward actual provider calls, job runtimes, email, storage, or AI-token usage into the ledger. Until those sources are wired, live workspace totals would be incomplete. No synthetic value is presented as live data.

## Existing state and evidence

- `backend-nest/prisma/schema.prisma:1014-1045` defines `AnalyticsEvent` with browser session, optional user, IP, user agent, referrer and arbitrary JSON fields. It has no workspace/event idempotency key.
- `backend-nest/prisma/schema.prisma:1935-1965` defines hourly/daily `UsageMetric`; `:4205-4227` defines billing `UsageRecord` with no idempotency key.
- `backend-nest/src/billing/usage-billing.service.ts:315-348` writes each `UsageRecord`, updates billing totals/alerts and asynchronously reports usage to Stripe. That made it unsuitable for internal cost analytics.
- `backend-nest/src/analytics/analytics.controller.ts:13-21,106-185` already provides JWT-authenticated workspace analytics; mapping and value-ledger operations use `AgencyRoleGuard`.
- `backend-nest/src/analytics/analytics.service.ts:115-197` reads/aggregates workspace usage metrics but cannot separate observed and estimated costs or experiment variants.
- `backend-nest/src/analytics/onboarding-funnel.service.ts:64-95` and `:22-59` implement explicit analytics consent and erase onboarding funnel data on revocation. The new feature/experiment events follow the same consent rule.
- `frontend/src/app/dashboard/analytics/page.tsx:42-105` is the existing analytics dashboard and was extended in place.

## Design / ADR

1. Preserve `UsageRecord`, Stripe reporting and the existing browser-oriented `AnalyticsEvent` contract.
2. Add an append-only `ProductTelemetryEvent` table with workspace/event uniqueness, controlled enums/slug fields and no arbitrary JSON or user/client identifiers. A repeated `(workspaceId,eventId)` is ignored by `createMany(skipDuplicates)`.
3. Require random UUID v4 event IDs and assign tenant scope exclusively from the authenticated request. Feature/experiment events require unexpired workspace analytics consent; consent revocation deletes those events. Operational usage/cost events are workspace-scoped and contain no person-level data.
4. Store measured quantity independently from optional cost. If a trustworthy cost amount exists, store integer millionths of currency and an explicit `OBSERVED` or `ESTIMATED` basis. Missing rates stay absent and are never zero-filled.
5. Aggregate in the database by workspace, feature, kind, category and period. Export experiment sample count, total and mean only; do not claim significance or causation.

The record endpoint is deliberately not connected to `UsageBillingService`; writing product telemetry cannot create a charge or Stripe side effect.

## Modified files

- `backend-nest/prisma/schema.prisma` — telemetry enums/model and workspace relation.
- `backend-nest/prisma/migrations/20261127230000_product_analytics_cost_accounting/migration.sql` — additive table, enums, workspace cascade FK and indexes.
- `backend-nest/src/analytics/product-analytics.dto.ts`, `product-analytics.service.ts` — payload validation, consent, idempotent ingest, scoped aggregates and CSV export.
- `backend-nest/src/analytics/analytics.controller.ts`, `analytics.module.ts` — POST event, GET summary and GET CSV endpoints in the existing module.
- `backend-nest/src/analytics/onboarding-funnel.service.ts` — remove feature/experiment telemetry transactionally when analytics consent is revoked; retain operational cost data.
- `backend-nest/src/analytics/product-analytics.service.spec.ts`, `product-analytics.integration.spec.ts`, `onboarding-funnel.service.spec.ts` — validation, retry, consent, cost categories and tenant regression coverage.
- `backend-nest/scripts/test-db-runner.cjs` — include the new integration test in the disposable DB suite.
- `frontend/src/lib/api/analytics.ts` — product analytics contracts and methods.
- `frontend/src/components/analytics/ProductAnalyticsPanel.tsx`, `frontend/src/app/dashboard/analytics/page.tsx` — observed/estimated costs, usage quantities, feature adoption/success/guardrails, experiment summary, CSV download, loading/empty/error/retry states and self-instrumented panel adoption/export/failure events.
- `e2e/tests/smoke.spec.ts` — fictional Northstar end-to-end telemetry and dashboard regression.
- `docs/analytics/product-telemetry.md` — event taxonomy and producer contract.
- `docs/agent-execution/23-goals-experiments-product-analytics.md` — this execution report.

## Migration and compatibility

The migration only adds enums, a table, indexes and a cascading workspace foreign key. Existing events and billing records are untouched; no backfill is needed. Deploy schema before code that writes the new model. Roll back by reverting application code and, if data retention policy permits, dropping only `product_telemetry_events` and its three enums. Do not roll back by truncating or modifying billing tables.

## API and UI contracts

- `POST /api/v1/analytics/product-events`: JWT + agency role + CSRF. Body fields are `eventId` (UUID v4), `featureKey`, `kind`, `eventName`, optional measured `value`/`unit`, optional cost category/basis/micros/currency, or optional experiment/variant. No `workspaceId`, arbitrary JSON, user ID, email, IP, provider payload or secret is accepted. Cost categories are provider call, job runtime, email, storage and AI tokens. A duplicate response is `{ accepted: false, duplicate: true }`; no-consent feature/experiment response is `{ accepted: false, duplicate: false, reason: "consent_required" }`.
- `GET /api/v1/analytics/product-analytics?days=30`: JWT + agency role, workspace-scoped. `days` is 1–90. Returns a period, generation/last-event timestamps, per-feature counts and usage, category-specific costs split into observed/estimated currencies, and experiment sample/total/mean aggregates.
- `GET /api/v1/analytics/product-analytics/experiments.csv?days=30`: JWT + agency role; exports aggregates only and has no event IDs.
- `/dashboard/analytics`: displays measured usage separately from costs, and observed versus estimated cost in separate columns. Empty data is explicit; loading, retryable error and export failure states are visible. No-data values are rendered as an em dash, not as zero.

## Checks and actual results

- `npm run prisma:validate` in `backend-nest` — **exit 0**.
- `node ./scripts/prisma-runner.cjs generate` in `backend-nest` — **exit 0**.
- `npm run test:integration` using `TEST_DATABASE_URL=postgresql://pulse_test:…@127.0.0.1:16434/pulse_test?schema=public` against disposable Docker Postgres/Redis — **exit 0**, 4 suites / 5 tests passed, all migrations applied; containers removed afterward.
- `npm test -- --runInBand --runTestsByPath src/analytics/product-analytics.service.spec.ts src/analytics/onboarding-funnel.service.spec.ts` — **exit 0**, 2 suites / 14 tests passed.
- `npm run typecheck` in `backend-nest` — **exit 0**.
- `npm run typecheck` in `frontend` — **exit 0**.
- Targeted ESLint on the new telemetry files, controller and Analytics module — **exit 0**. The existing `onboarding-funnel.service.ts` is excluded from the targeted lint command because the repository file already has broad Prettier-rule violations outside this change; its revocation behavior is covered by the passing unit test.
- `npm run build -- --webpack` in `frontend` — **exit 0**, production compilation, TypeScript and all 63 static pages completed.
- `npm run test:smoke -- --grep "product analytics records tenant-scoped costs"` in `e2e`, with `TEST_POSTGRES_PORT=16434`, `TEST_REDIS_PORT=17380` — **exit 0**, 1 Playwright test passed; its test DB prelude passed 4 suites / 5 tests. It verifies consented events, duplicate suppression, measured and priced amounts, dashboard rendering, UI CSV download, CSV contract and client-member 403.
- An earlier version of that E2E command exited **1** because the test omitted required CSRF headers for consent changes. The test was corrected to use the repository’s CSRF convention; the final run above passed.

OAuth providers were not configured and were not used. The smoke app logs Redis disconnects when its disposable containers are deliberately torn down; the test result remains exit 0.

## Manual smoke steps

1. Apply the additive migration in a local environment and start the app.
2. Sign in as an agency owner/admin and opt into workspace analytics.
3. Submit one UUID-v4 feature adoption, success and guardrail event; submit it twice and confirm only one event is counted.
4. Submit a measured usage event without a rate and confirm usage is shown while cost remains unavailable. Submit an observed and an estimated amount in separate currencies/categories and confirm the dashboard keeps each basis/category separate.
5. Submit two experiment outcomes for a variant; export results and verify sample count, total and mean without raw event IDs.
6. Sign in as a client member and verify dashboard/API access is denied. Revoke workspace consent and confirm feature/experiment telemetry is erased while operational cost records remain.

## Security and tenant review

Every query derives `workspaceId` from the authenticated JWT and every write assigns it server-side. The record payload has no tenant selector. A database uniqueness constraint prevents duplicate delivery within a workspace; integration tests verify one tenant cannot read another tenant’s features/experiments through summary or CSV. Agency role guard denies client `MEMBER` accounts. All writes remain behind the application CSRF policy. No raw event retrieval endpoint exists.

## Data privacy

No person-level or customer-content data is stored. Random UUID v4 keys avoid email- or provider-ID-based idempotency identifiers. Feature/experiment analytics requires current consent, and revocation deletes those records. Operational usage is aggregate workspace telemetry only. Events are not client-visible. Retention for operational cost data remains a workspace/accounting policy assumption and is not automatically purged.

## Rollback

Revert the analytics UI/API/service changes. The additive table can remain dormant for a forward-only rollback, preserving event history. If removal is required, first confirm the workspace accepts permanent loss of the new telemetry table, then apply a dedicated reverse migration; no destructive rollback is part of this change. Billing/Stripe state is independent and unaffected.

## Unverified assumptions and blocker

- The local E2E posts explicitly fictional values to exercise the contracts; they are not live provider measurements.
- No stable provider price/rate feed is present for provider calls, jobs, email, storage or AI tokens. The generic ingestion accepts optional source-backed amounts but does not infer rates.
- Product event producers are not yet wired across the provider/job/email/storage/AI call sites. The analytics panel self-reports its own view/export/load failure only; other feature adoption/success/guardrail and cost rows remain empty until producers call the contract.
- Real provider accounts/keys and live cost reconciliation were not used and are not required for local contract tests. They remain a separate verification step after safe producer wiring.
- Operational cost retention and currency normalization policy remain unspecified. Totals are intentionally grouped by currency and are not converted.

## Before Phase 24

Wire the event contract to trusted provider-call, job-runtime, email, storage and AI-token producers using stable UUID-v4 idempotency keys; add source/rate configuration only where a real observed amount or a clearly versioned estimate exists. Add retry/duplicate and partial-provider fixture tests for each producer, run the dashboard with only synthetic data locally, and separately reconcile a consented, authorized live provider sample before treating totals as complete. Until then, keep this phase **BLOCKED for production cost reporting**.
