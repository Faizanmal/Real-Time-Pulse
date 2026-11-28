# Phase 20 — Onboarding template library

Status: **PASS (local implementation and scoped validation); live-provider verification remains unverified.** No production settings, provider accounts, email delivery, or external analytics services were used.

## Existing state and evidence inventory

Before this phase, registration already created the agency workspace in `backend-nest/src/auth/auth.service.ts`; the demo portal bootstrap lived in `backend-nest/src/portals/portal.service.ts`; a synthetic provider adapter existed in `backend-nest/src/integrations/services/demo-connector.service.ts`; public client views used the portal/share-link services; and decision and paid-conversion business events were already handled by `decision-inbox` and `billing`. The reusable template and demo infrastructure was therefore extended instead of adding a duplicate onboarding module.

Existing telemetry primitives included `GDPRConsent` in `backend-nest/prisma/schema.prisma` and a generic `EventStore`. They did not provide a consent-gated, anonymized onboarding funnel or resumable setup screen. Existing tests and smoke flow were in `backend-nest/src/**/**/*.spec.ts` and `e2e/tests/smoke.spec.ts`.

New implementation evidence:

- Funnel stages and storage: `backend-nest/prisma/schema.prisma:126-147`; additive SQL in `backend-nest/prisma/migrations/20261127210000_onboarding_funnel/migration.sql`.
- Consent, HMAC pseudonyms, deduplication, retention and workspace status: `backend-nest/src/analytics/onboarding-funnel.service.ts:21-187`.
- Authenticated status/consent API: `backend-nest/src/analytics/onboarding-funnel.controller.ts:14-29`.
- Signup opt-in: `backend-nest/src/auth/dto/auth.dto.ts:76-79`, `backend-nest/src/auth/auth.service.ts:159-180`, and `frontend/src/app/auth/signup/page.tsx:414-421`.
- Resumable demo setup, provider recovery and client-view link: `frontend/src/app/dashboard/onboarding/page.tsx:22-151`; navigation entry: `frontend/src/app/dashboard/layout.tsx:74`.
- API client: `frontend/src/lib/api/onboarding.ts:1-39`.
- Milestone hooks: integration create (`backend-nest/src/integrations/integration.service.ts:158,284`), demo bootstrap/publish/public view (`backend-nest/src/portals/portal.service.ts:74-203,241,342`), successful and duplicate sync job (`backend-nest/src/jobs/processors/data-sync-queue.processor.ts:93,207`), client share view (`backend-nest/src/share-links/share-links.service.ts:474`), client decision response (`backend-nest/src/decision-inbox/decision-inbox.service.ts:302`), and confirmed paid invoice (`backend-nest/src/billing/billing.service.ts:628`).
- End-to-end assertions and demo journey: `e2e/tests/smoke.spec.ts:109-120,524-527,1189-1191`.

## Scoped plan and design decision

The scoped plan was to audit and reuse auth, GDPR consent, demo connector, portal publishing, client viewing, decision and billing flows; then add a consent-gated funnel, idempotent milestone hooks, a resumable browser workflow, regression coverage and an execution report. This is implemented using the existing Analytics, Auth, Integrations, Portals, Jobs, ShareLinks, DecisionInbox and Billing modules.

**ADR:** Treat funnel measurement as optional product analytics, separate from operational records. Store one first-occurrence event per pseudonymous workspace journey and stage. Derive a keyed HMAC-SHA256 journey key from the workspace ID; never store the original ID or event payload in the funnel event table. Keep consent receipts in the existing GDPR consent table, append each preference change as a new receipt, and erase that journey’s funnel rows on revocation. Telemetry failure must not fail signup, sync, publish, client access, or a paid invoice. The sample onboarding path uses the existing synthetic demo connector and published portal; connecting an actual provider remains an explicit later user action.

## Modified files

Phase 20 additions/changes:

- `backend-nest/prisma/schema.prisma` and `backend-nest/prisma/migrations/20261127210000_onboarding_funnel/migration.sql`
- `backend-nest/.env.example`
- `backend-nest/src/analytics/onboarding-funnel.service.ts`, `onboarding-funnel.controller.ts`, `onboarding-funnel.service.spec.ts`, and `analytics.module.ts`
- `backend-nest/src/auth/auth.service.ts`, `auth/dto/auth.dto.ts`, `auth.module.ts`
- `backend-nest/src/integrations/integration.service.ts`, `integration.module.ts`
- `backend-nest/src/portals/portal.service.ts`
- `backend-nest/src/jobs/processors/data-sync-queue.processor.ts`, `jobs/jobs.module.ts`
- `backend-nest/src/share-links/share-links.service.ts`, `share-links.module.ts`
- `backend-nest/src/decision-inbox/decision-inbox.service.ts`, `decision-inbox.module.ts`
- `backend-nest/src/billing/billing.service.ts`, `billing.module.ts`, and `billing.service.spec.ts`
- `frontend/src/app/auth/signup/page.tsx`, `frontend/src/app/dashboard/onboarding/page.tsx`, `frontend/src/app/dashboard/layout.tsx`, `frontend/src/lib/api/onboarding.ts`, and `frontend/src/lib/api-client.ts`
- `e2e/tests/smoke.spec.ts` and local smoke configuration for a test-only HMAC key.

The repository already contains work from earlier phases. This list identifies Phase 20 touchpoints; unrelated existing changes were not attributed to Phase 20.

## Migration and compatibility

The migration adds one enum and one table with unique indexes; it does not rewrite or backfill existing workspace data. Existing users remain untracked until an owner/admin explicitly enables analytics. Signup behavior is backward-compatible because the consent field is optional and defaults false in the UI. The server key is optional; without a configured value of at least 32 bytes tracking remains disabled, and application flows continue normally. Set `ONBOARDING_FUNNEL_HMAC_KEY` from a secret manager before enabling collection in a real environment; use a stable key and plan rotation deliberately because rotation changes pseudonymous journey identity.

Rollback can remove the UI/hooks and disable/remove the new table in a later migration after stopping event writes. It does not require reverting or deleting consent receipts, which are shared with the existing GDPR subsystem. No destructive migration or production change was made.

## API and UI contracts

- `GET /onboarding/status` (JWT): returns the requesting owner/admin’s consent state, configured/tracking availability, this workspace’s stages and completion count, safe provider connection/recovery details, and the existing demo client path/publication time. Other workspace IDs are not accepted from request parameters.
- `PATCH /onboarding/analytics-consent` (JWT, boolean `{ consented }`): appends a GDPR consent receipt. Revocation deletes previously collected pseudonymous funnel events for the workspace journey. Only a workspace owner/admin may view or change these settings.
- `POST` signup accepts optional `onboardingAnalyticsConsent`; omitted/false means no tracking. Signup remains successful if telemetry is unavailable.
- The dashboard onboarding screen supports loading, status-unavailable, retry, setup failure and empty/unconsented states. “Create demo portal”/“Resume demo setup” uses fictional local data, can be resumed after refresh, and provides a client view link for the published sample. Link copy/open does not send email or notify a client. Provider failures include the connector failure code and a link to Integrations for retry/reconnect.
- Funnel event data contract: `{ journeyKey, eventKey, stage, happenedAt }`. `journeyKey` and `eventKey` are keyed HMAC digests; no tenant/user/client/provider identifiers or raw payload are persisted. Unique `(journeyKey, stage)` and `eventKey` indexes make repeated delivery idempotent.

## Tests and actual command results

Commands were run locally with fictional fixtures and a disposable Docker Compose database/Redis on ports 16432 and 17379. No real provider keys were used.

| Command | Result |
| --- | --- |
| `npm test -- --runInBand src/analytics/onboarding-funnel.service.spec.ts src/portals/portal.service.spec.ts src/portals/portal.service.publish.spec.ts src/decision-inbox/decision-inbox.service.spec.ts src/jobs/processors/data-sync-queue.processor.spec.ts` (from `backend-nest`) | **exit 0** — 5 suites, 30 tests passed |
| `npm test -- --runInBand src/billing/billing.service.spec.ts -t "records first paid conversion"` (from `backend-nest`) | **exit 0** — 1 targeted test passed; 14 unrelated tests skipped by filter |
| `npm run prisma:validate` (from `backend-nest`) | **exit 0** — schema valid |
| `npx prisma generate` (from `backend-nest`) | **exit 0** — Prisma Client generated |
| `npm run typecheck -- --pretty false` (from `backend-nest`) | **exit 0** |
| `npm run build` (from `backend-nest`) | **exit 0** |
| `npm run typecheck -- --pretty false` (from `frontend`) | **exit 0** |
| `npx eslint src/app/auth/signup/page.tsx src/app/dashboard/onboarding/page.tsx src/app/dashboard/layout.tsx src/lib/api/onboarding.ts src/lib/api-client.ts` (from `frontend`) | **exit 0**, 20 warnings and 0 errors; warnings include existing long signup/layout functions and React Compiler/effect rules, including an effect warning on the new page’s initial load |
| `git diff --check` | **exit 0**; only line-ending conversion warnings for existing modified files |
| Playwright `npm run test:smoke -- --grep "agency creates persistent client portal and other workspace remains denied"` (from `e2e`, test DB/Redis ports above) | **exit 0** — 1 smoke test passed; its DB-prep integration run reported 3 suites / 4 tests passed. Containers were cleaned up. |
| `npm test -- --runInBand src/analytics/onboarding-funnel.service.spec.ts src/auth/auth.service.spec.ts src/billing/billing.service.spec.ts src/portals/portal.service.spec.ts src/portals/portal.service.publish.spec.ts src/decision-inbox/decision-inbox.service.spec.ts src/jobs/processors/data-sync-queue.processor.spec.ts` | **exit 1** — focused onboarding/portal/decision/worker suites passed, but the broad legacy auth suite failed to load Firebase/Jose ESM under Jest CommonJS, and the existing billing suite has unrelated Stripe config/Prisma fixture failures. The new paid-conversion test passes independently as listed above. |

The Playwright smoke covers owner opt-in, no-key demo creation, invitation/client view, first-view milestone, and tenant denial assertions already in that scenario. The decision milestone is checked in the E2E source and its service instrumentation is covered by focused service tests, but the full decision E2E was not run in this pass.

## Manual smoke steps

1. Start the local test stack using the repository’s isolated test Compose configuration and test-only environment values; do not point it at a shared or production database.
2. Register a fictional agency with the analytics consent checkbox left off. Confirm the onboarding screen reports no funnel events.
3. As the owner, enable consent and create the demo portal. Confirm the provider is labeled fictional/demo and the client path opens the published sample.
4. Reload the dashboard and confirm setup and stage state resume. Copy the invitation link and verify no email is generated.
5. Revoke analytics consent. Confirm the UI reflects revocation and status returns no recorded stages.
6. For provider recovery, use a local fixture with an expired/failed connection and follow “Review connections and retry”; do not supply a live provider key for the local path.

## Security and tenant review

Both routes require JWT authentication and derive the workspace from the authenticated principal. The service verifies the user belongs to that workspace and has OWNER/ADMIN role. Guessed workspace IDs and non-admin access are covered by service tests. Milestone hooks pass the owning workspace from already-authorized business records; there is no caller-controlled workspace ID on the status/consent API. DB uniqueness protects retried worker delivery and repeated hook calls. Registration hooks are optional and failure-isolated.

The demo client URL is a capability link to the intentionally published fictional sample, and the UI describes it as shareable only with the intended tester. No automatic invite email or client notification is sent. Funnel status uses only the authenticated workspace’s HMAC journey key.

## Data privacy

Collection is opt-in and expires when the existing consent receipt expires. Preference changes append immutable consent records. Revocation removes that workspace’s funnel events in the same transaction. Stored funnel event rows contain only two HMAC digests, a fixed enum stage, and timestamp. There is no external analytics sink. Old funnel rows are removed after 180 days by bounded cleanup on status access/event recording. The existing GDPR consent receipt stores the owner email as required by the existing consent model; this is separate from funnel event rows and must be handled under existing consent retention policy.

## Unverified assumptions and limitations

- No production HMAC key or secret-manager wiring was validated. Tracking is disabled when the key is absent/weak. Key rotation changes identity and requires an explicit retention/continuity policy.
- No live OAuth/provider reconnection, provider account, billing webhook, email or notification was exercised. Failure recovery was validated as a UI route and local status contract only.
- The current status page shows workspace-local milestones. It does not expose cross-workspace product funnel aggregates or conversion rates; those require a separate authorized analytics/reporting design.
- The invitation is the existing public demo view link, not a generated expiring client invite workflow. No email dispatch is implemented by this phase.
- Signup OAuth paths do not currently present this new opt-in control; they remain untracked unless an owner/admin consents in onboarding settings.
- Lint exits successfully but has the warnings listed above. Full legacy auth/billing suites remain noisy/failing as detailed in test output; scoped tests, build, typecheck and demo smoke pass.

## Before Phase 21

Keep the current funnel disabled in any environment without managed HMAC-key setup and explicit consent policy. Before Phase 21 starts, decide whether its delivery/alerting needs aggregate product funnel data, define an authorized aggregation and key-rotation/retention policy if so, and specify whether a real client invitation should send email and require separate consent. Then continue Phase 21 against local fixtures first; no live provider or client messaging should be enabled by this report.


