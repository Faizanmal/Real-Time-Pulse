# Phase 18 — Reporting delivery

## Status

**PASS for local acceptance; no production deployment performed.** A disposable Docker PostgreSQL/Redis stack applied the migration and the full reporting browser path passed using fictional fixtures and a test-only email transport. Live SMTP delivery and a production database rollout remain intentionally unverified.

## Existing state and audit evidence

- `ClientReport` stored mutable report content and a status but no approved content version (pre-change model at `backend-nest/prisma/schema.prisma:2417`; status enum at `:2522`). The controller already exposed create/get and other report routes (`backend-nest/src/client-report/client-report.controller.ts:50`, `:108`).
- `ReportGeneratorService.approveBriefing` already gated approval by workspace and recorded consent in `AuditLog` (`backend-nest/src/client-report/report-generator.service.ts:73`); its prior renderer read mutable report fields directly and delivery failure had no per-revision retry record.
- Portal exports read live portal/widget state separately: PDF at `backend-nest/src/exports/export.service.ts:51` and CSV at `:131`. Those export routes were not tied to one approved report revision.
- `ScheduledReportsService` already creates `ReportRun` rows and sends reports; timezone-sensitive `calculateNextRun` is at `backend-nest/src/scheduled-reports/scheduled-reports.service.ts:378`.
- Agency reporting UI exists in `frontend/src/components/reporting/ClientReportingDashboard.tsx:38`; public share pages are at `frontend/src/app/share/[token]/page.tsx`. Existing agency report routes use JWT, agency-role and billing guards.
- No root `AGENTS.md` was present. Relevant repository and frontend instructions were reviewed.
- Additional end-to-end checks exposed two defects and added regression coverage: generated canonical summaries were split into sentences before comparison, incorrectly rejecting the generated summary at approval; and the global JSON `ResponseInterceptor` wrapped `StreamableFile`, returning serialized stream internals instead of CSV/PDF bytes. Both are fixed and covered by focused tests. The cross-format browser test also waits for revision mutations before asserting the updated view.

## Design / ADR

Keep the existing `ClientReport` workflow and add an additive versioned snapshot model. Approval captures canonical structured facts, summary, period freshness, and approver/consent metadata into `ClientReportRevision`; a SHA-256 digest detects snapshot mutation. Email, PDF, CSV, and client portal rendering use that exact stored snapshot, preventing independent recalculation/rounding drift.

Delivery state is stored once per immutable revision. A transaction claims `SENDING`; successful send becomes `SENT`; a known transport failure becomes `FAILED` and can be retried explicitly. Repeated delivery after `SENT` does not send again. A process crash after the external mail server accepts a message but before the database is updated leaves `SENDING`, which intentionally blocks automatic resend to avoid duplicate mail; operator reconciliation is required.

For client portal visibility, a report must be linked to a portal and its revision must have explicit notification consent, confirmed `SENT` delivery, and a report in `SENT` state. The share link must allow export, be active/unexpired, and be assigned to the authenticated MEMBER client. Client projections omit internal report/workspace/recipient IDs and snapshot digests.

Scheduled report cron parsing now uses the existing `cron-parser` package with the configured IANA timezone, supporting both the existing five-field inputs and six-field parser format. Existing portal scheduled-report flow is retained.

## Modified files

- `backend-nest/prisma/schema.prisma`
- `backend-nest/prisma/migrations/20261127180000_report_delivery_revisions/migration.sql`
- `backend-nest/src/client-report/client-report.service.ts`
- `backend-nest/src/client-report/client-report.controller.ts`
- `backend-nest/src/client-report/client-report.module.ts`
- `backend-nest/src/client-report/client-report-public.controller.ts`
- `backend-nest/src/client-report/report-generator.service.ts`
- `backend-nest/src/client-report/report-delivery.ts`
- `backend-nest/src/client-report/report-generator.service.spec.ts`
- `backend-nest/src/client-report/report-delivery.spec.ts`
- `backend-nest/src/client-report/client-report.service.security.spec.ts`
- `backend-nest/src/client-report/client-report-public.controller.spec.ts`
- `backend-nest/src/client-report/client-report.controller.e2e.spec.ts`
- `backend-nest/src/client-report/verified-briefing.ts` (TypeScript narrowing compatibility)
- `backend-nest/src/client-report/verified-briefing.spec.ts`
- `backend-nest/src/common/interceptors/response.interceptor.ts`
- `backend-nest/src/common/interceptors/response.interceptor.spec.ts`
- `backend-nest/src/email/email.service.ts` (local test transport; it never contacts SMTP)
- `backend-nest/prisma/seed-test-fixtures.ts` (fictional project profitability data)
- `e2e/playwright.smoke.config.ts`
- `e2e/tests/smoke.spec.ts` (approval, delivery, revision, download and client portal parity path)
- `backend-nest/src/share-links/share-links.service.ts`
- `backend-nest/src/scheduled-reports/scheduled-reports.service.ts`
- `backend-nest/src/scheduled-reports/schedule-time.ts`
- `backend-nest/src/scheduled-reports/schedule-time.spec.ts`
- `frontend/src/lib/api-client.ts`
- `frontend/src/components/reporting/ClientReportingDashboard.tsx`
- `frontend/src/components/client-portal/SharedClientReportsPanel.tsx`
- `frontend/src/app/share/[token]/page.tsx`
- This report.

## Migration notes

`20261127180000_report_delivery_revisions` adds nullable `client_reports.portalId`, a `revision` column defaulting existing rows to 1, `client_report_revisions`, and `client_report_deliveries`. Foreign keys and indexes are additive. Existing reports are not automatically published or backfilled into immutable approved revisions; prior `SENT` records have no verifiable consent snapshot and therefore do not become client-portal report entries. Existing portal links retain current behavior. New client-visible reports need a portal selected in the agency reporting UI.

The migration **was applied successfully to a clean disposable Docker PostgreSQL database** using the test migration runner and alternate local ports (Postgres 16432, Redis 17379, because the default PostgreSQL port was already occupied). All 23 repository migrations, including `20261127180000_report_delivery_revisions`, applied with exit 0. The browser smoke runner also booted isolated database/cache containers and completed. This verifies test-database migration safety only. Before production rollout, inspect the production database provider and migration history; do not run `db push --accept-data-loss`. Roll back application routes/UI while retaining additive revision/delivery tables and rows. `portalId` remains nullable.

## API contract

- Existing agency API remains under `/api/v1/client-reports` with JWT, agency-role and billing guards.
- `GET /:reportId/preview` returns current proposed content and verified source facts for agency review.
- `POST /:reportId/approve` retains its explicit `notifyClient`/consent-note contract. Approval creates an immutable versioned snapshot. No notification is sent without explicit consent.
- `POST /:reportId/retry-delivery` retries only a consented approved revision with known `FAILED` state. Duplicate requests for a `SENT` revision return without another send; concurrent `SENDING` requests conflict.
- `GET /:reportId/revisions/:version/pdf` and `/csv` require agency authorization and constrain the revision through the report’s workspace. Responses are raw binary streams (not JSON envelopes), use attachment headers, `no-store`, and `nosniff`. The global response interceptor now preserves `StreamableFile`, so PDF/CSV bytes reach browser download clients correctly.
- Client portal `POST /api/v1/share-links/public/:token/client-reports/list` requires a signed-in exact assigned client, active/nonexpired share link, password when configured, and `allowExport`. It returns only explicitly consented, delivered reports linked to that portal. Response is private/no-store.
- Delivery API data exposes state, attempts, error category and sent timestamp to the agency; it does not expose provider credentials or internal message payloads.

## UI contract

- Agency reporting page has loading/error/retry/empty states; new report requires selecting a workspace portal. Agency can preview exact candidate content, edit/generate, approve, and optionally send after consent confirmation. Approved revisions show revision number, timestamp, PDF/CSV actions, delivery state, attempt count, and retry control for known failures.
- Client share page shows a “Delivered reports” section only when the share link permits export. It has loading/error/retry/empty states and semantic headings/table-like metric facts, source references, data-as-of and delivery timestamps. Only successful consented deliveries appear.
- Portal/email/PDF/CSV values all render from one immutable snapshot; no missing metric is replaced by zero.

## Test commands and actual output

- `cd backend-nest; npm run prisma:validate; node ./scripts/prisma-runner.cjs generate; npm run typecheck -- --pretty false; npm run build` — **each exit 0** (captured `VALIDATE_EXIT=0 GENERATE_EXIT=0 TYPECHECK_EXIT=0 BUILD_EXIT=0`).
- `cd backend-nest; npm test -- --runInBand src/client-report src/scheduled-reports/schedule-time.spec.ts src/common/interceptors/response.interceptor.spec.ts` — **exit 0**, 8 suites / 36 tests passed. Covers immutable report generation, approval and notification consent, failure/retry/idempotency, tenant checks, assigned-client denial, schedule DST behavior, canonical summary validation, digest key-order stability and binary response preservation.
- `cd backend-nest; npm test -- --runInBand src/client-report/client-report.controller.e2e.spec.ts` with loopback permission — **exit 0**, 1 suite / 4 tests passed, including unauthorized download and guessed foreign-tenant resource denial. The sandboxed attempt without loopback permission returned EACCES; rerun with local socket permission passed.
- Docker migration run on disposable PostgreSQL — **exit 0**, all 23 migrations applied, including the reporting-delivery migration.
- `cd e2e; $env:TEST_DATABASE_URL='postgresql://pulse_test:pulse_test_only_password@127.0.0.1:16432/pulse_test?schema=public'; $env:TEST_POSTGRES_PORT='16432'; $env:TEST_REDIS_PORT='17379'; npm run test:smoke -- --grep "approved report snapshot"` — **exit 0**, 1 Playwright test passed (5.9s). Its startup preflight also passed 3 DB/integration suites / 4 tests. The browser path creates a draft from the fictional Northstar fixture, verifies source/date, approves with explicit consent, uses test-only delivery, confirms `SENT`/attempt count, compares CSV/PDF/portal values, preserves revision 1 after a revision 2 draft, and denies client direct download.
- `cd frontend; npm run typecheck -- --pretty false` — **exit 0**.
- `cd frontend; npm exec -- eslint src/components/reporting/ClientReportingDashboard.tsx src/components/client-portal/SharedClientReportsPanel.tsx src/lib/api-client.ts` — ESLint reported **0 errors / 3 warnings** (large existing component and state-setting inside load effects); it printed `ESLINT_EXIT=0`. The npm wrapper did not terminate after printing the exit variable and was interrupted; ESLint itself completed successfully.
- `git diff --check` — **exit 0**, with line-ending normalization warnings only.

## Manual smoke steps

1. Start the local disposable Postgres/Redis stack, apply migrations, and run backend/frontend with test-only settings. The automated smoke run already exercises this flow; these are additional manual operator checks.
2. As agency owner, create a draft, select its intended client portal, generate facts, preview, and confirm values/source/date.
3. Approve without notification; confirm no email is sent and the revision is not visible to client portal.
4. Create/approve another draft with explicit notification consent and fictional `.invalid` test recipient; verify delivery record and accessible HTML message.
5. Download that exact revision as PDF and CSV; compare each metric value, unit, source, revision, and freshness timestamp to the email and client portal view.
6. Reload portal as its assigned client; verify same revision/content. Try an unassigned client, another tenant’s report/portal ID, link without export permission, expired/revoked link, and unauthenticated request; all must be denied or return no data.
7. Simulate mail transport false/error; verify approved snapshot remains intact, delivery shows `FAILED`, and explicit retry increments count. Replay after `SENT`; verify no second email.
8. Run a 09:00 America/New_York weekday schedule through the spring DST transition and verify the next UTC instant corresponds to local 09:00.

## Security / tenant review

Agency download and preview use the authenticated workspace ID; report revision lookup includes its parent report workspace. Public client route requires exact assigned user membership and matching share-link workspace, active/not expired/password-valid link, and export capability. Client report lookup then matches both portal and workspace and `SENT`/consented delivery state. Cross-workspace portal IDs are rejected at report creation. Report recipient addresses remain agency-only and are not projected into the client portal response. Existing share links do not gain access by default; the portal visibility gate uses their existing explicit `allowExport` permission.

## Data privacy

Approved snapshot stores report summary, numeric source facts, units, source references, period freshness, approver ID, and opt-in consent note. PII redaction applies to snapshot title/client name/summary/fact labels/units/source labels; HTML is escaped. Existing recipient emails remain on `ClientReport`; public projection omits them. Failure records persist a generic error category, not raw SMTP errors or credentials. Fictional fixture identities use `.invalid` addresses. No live provider keys or email accounts are needed for tests.

## Rollback

Disable the new preview/download/retry and portal report UI/routes and roll back the application. Existing schedules and portal exports continue on their prior contract. Leave additive schema and report revision/delivery rows in place; avoid destructive table drops or backfills. On delivery incident, disable retry and keep failed/sending state for reconciliation. No production settings or deployment were changed.

## Unverified assumptions and limitations

- Live SMTP delivery and provider acceptance were not exercised; E2E uses `EMAIL_TEST_TRANSPORT=true`, which is deliberately non-sending. Email rendering parity is covered by deterministic unit fixtures; no real recipient was contacted.
- Migration was applied to a clean disposable PostgreSQL database, not to production or staging. Production provider-specific behavior, maintenance window and backup policy must be confirmed by the release operator.
- No moderated usability study or assistive-technology manual session was performed; browser E2E verifies semantic labels, content and refresh behavior but does not replace those human checks.
- A `SENDING` row after process crash is intentionally not auto-retried; it requires operator reconciliation to avoid a duplicate message if the mail server accepted before crash.
- Scheduled portal reports are an existing separate workflow and still send according to their existing configuration; this phase fixes timezone parsing but does not redesign that separate pipeline around `ClientReportRevision`.
- Reports can optionally originate from a project; a selected portal association is required in the updated agency UI for client portal delivery. Human must verify the portal/client pairing before approval; the current schema has no canonical project-to-portal client identity mapping.

## Before Phase 19

Have the product/release owner review the portal-to-client association assumption and decide whether to schedule a separate live SMTP verification with an explicitly authorized test recipient. Keep production migration/deployment gated until normal release review, backup and migration-history checks are complete. No Phase 18 implementation or local test blocker remains.
