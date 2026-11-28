# Phase 16 — AI client briefings

**Status: PASS (local/mock implementation checks).** No LLM is called by this workflow. Live SMTP delivery and manual browser smoke remain unverified; neither was used to claim a live result.

## Existing state and evidence inventory

The repository already had a `ClientReport` feature, so this phase extends it rather than adding another reporting module. Before changes, `backend-nest/prisma/schema.prisma` defined `ClientReport` (model near line 2411) with `DRAFT`, `SCHEDULED`, `GENERATING`, `SENT`, and `FAILED` states (enum near line 2464). `backend-nest/src/client-report/report-generator.service.ts` previously generated generic historical-pattern text and numeric recommendations without source evidence, filled absent project values with zero, and sent scheduled reports from its cron path. The controller and service accepted report IDs without consistently scoping all lookups and mutations to the authenticated workspace. `frontend/src/components/reporting/ClientReportingDashboard.tsx` was the existing dashboard surface; the route at `frontend/src/app/client-reports/page.tsx` now renders that same component.

The root `AGENTS.md` and requested reference pack documents were checked and were not present in this checkout. The local `frontend/AGENTS.md` was read, including its Next.js documentation requirement. Current evidence locations include:

- `backend-nest/prisma/schema.prisma:2464` — report status enum; `:2411` — existing report model.
- `backend-nest/src/client-report/client-report.controller.ts:31-39` — controller guard and feature-state route; `:125-164` — draft generation and approval endpoints.
- `backend-nest/src/client-report/client-report.service.ts:15-34` — tenant-scoped create/project validation; `:62-87` — workspace-scoped read; `:90-128` — draft-only edit and conflict fence; `:132-158` — draft-only delete and approved-to-sent transition.
- `backend-nest/src/client-report/report-generator.service.ts:36-69` — scheduled/on-demand jobs produce drafts without sending; `:73-151` — verification, atomic approval, audit, explicit consent and send; `:160-212` — fresh structured facts only; `:215-238` — escaped, redacted email output.
- `backend-nest/src/client-report/verified-briefing.ts:14-59` — PII redaction, numeric claim checks, sentence policy and “not enough verified data” text.
- `frontend/src/components/reporting/ClientReportingDashboard.tsx:33-160` — authenticated workspace, loading/error/empty states, fact/source display, draft editing and explicit approval controls.
- `backend-nest/src/client-report/client-report.controller.e2e.spec.ts` and neighboring `*.spec.ts` — HTTP contract, tenant, approval, data-quality and security regression tests.

### Scoped plan executed

1. Reuse the existing ClientReport schema/service/controller/dashboard.
2. Replace fabricated report claims and zero-fill with recent structured facts and explicit missing-data output.
3. Fence all report operations to the authenticated agency workspace and owner/admin approval roles.
4. Require agency approval and separately recorded consent before email; preserve an audit event.
5. Add UI states, deterministic fixtures, tenant/permission/duplicate/verification tests, migration and this execution record.

## Design / ADR

- **ADR:** A briefing is a draft generated from structured project/profitability facts. We do not invoke a language model in this path, because the available repository data does not provide grounded generated prose or a safe prompt/data boundary. Unsupported statements are rejected unless explicitly prefixed `Human note (unverified):`; any numeric value in such a note must still match a structured fact. Executive-summary PII is redacted on write; email title and summary are redacted before rendering, and email HTML is escaped. Recipient addresses remain stored for the existing delivery workflow.
- A fact is eligible only when its project profitability calculation timestamp (or project update timestamp when no profitability timestamp exists) is no older than 24 hours. Missing values are omitted; no implicit zero. If there are no fresh numeric facts, the summary says “Not enough verified data to report an outcome.” Every included fact carries a source reference and the report carries `asOf`.
- The state transition for notification is draft → approved → sent. Approval is conditional on `DRAFT` in a database update, making concurrent/repeated approval attempts conflict. Email is sent only when an agency owner/admin submits `notifyClient: true` with a consent note. Consent, actor, request context and approval are recorded in `AuditLog` in the approval transaction. Scheduled generation now produces an agency draft only.
- The approval/notification feature is gated by `CLIENT_BRIEFINGS_ENABLED === 'true'`, default off. This flag was not set in any production configuration.

## Modified files

- `backend-nest/prisma/schema.prisma` — add `APPROVED` to `ClientReportStatus`.
- `backend-nest/prisma/migrations/20261126160000_ai_client_briefings/migration.sql` — additive enum value.
- `backend-nest/src/client-report/client-report.controller.ts`, `client-report.service.ts`, `client-report.module.ts`, `report-generator.service.ts` — role/tenant checks, draft workflow, approval/send controls and auditing.
- `backend-nest/src/client-report/verified-briefing.ts` — deterministic claim checks, redaction, escaping and summary policy.
- `backend-nest/src/client-report/report-generator.service.spec.ts`, `verified-briefing.spec.ts`, `client-report.service.security.spec.ts`, `client-report.controller.e2e.spec.ts` — fixtures and regression coverage.
- `frontend/src/components/reporting/ClientReportingDashboard.tsx`, `frontend/src/app/client-reports/page.tsx`, `frontend/src/lib/api-client.ts` — dashboard workflow, route reuse and API calls.
- `docs/agent-execution/16-ai-client-briefings.md` — this record.

The checkout contained substantial unrelated pre-existing modifications from earlier phases. They were left intact.

## Migration and API/UI contracts

Migration is additive: `ALTER TYPE "ClientReportStatus" ADD VALUE IF NOT EXISTS 'APPROVED'`. No row backfill is needed. Apply the migration before running the new application version. Older consumers that exhaustively decode report status must be checked for the new `APPROVED` value.

New/updated routes (all require a JWT, agency role and active OWNER/ADMIN membership):

- `GET /api/v1/client-reports/briefing-feature` → `{ enabled: boolean }`.
- Existing `POST /api/v1/client-reports/:reportId/generate` remains; it now returns a verified draft and never contacts a client.
- `POST /api/v1/client-reports/:reportId/approve` body `{ notifyClient?: boolean, consentNote?: string }`. `notifyClient: true` requires an 8–500 character consent note and configured recipients. Flag off returns 404. Approval without notification makes no email call.
- Existing workspace list/stats routes require the path workspace to equal the authenticated workspace. Report detail, update, delete, generation and approval use the caller's workspace for lookup/mutation. Cross-workspace IDs return not found.
- `PATCH /:reportId` accepts only `title` and `executiveSummary`; summaries are capped at 20,000 characters and can only be changed while DRAFT. Unsupported claims block approval unless marked as unverified human text; numeric claims always need a matching fact.

The UI shows loading/error/retry/empty states, status, source fact, unit and `asOf`. Users can create, regenerate and edit drafts, approve without notifying, or separately approve with explicit consent. The feature gate disables approval controls when off. It does not show synthetic growth/ROI. The UI is checked by TypeScript and targeted lint, but no interactive browser session was run.

## Verification (actual results)

- `npm run test:db:up` — **exit 0**; started a disposable loopback PostgreSQL test database using Docker.
- `npm run test:db:migrate` — **exit 0**; applied the repository migrations, including `20261126160000_ai_client_briefings`, to that disposable database.
- `npm run prisma:validate` — **exit 0**; Prisma schema valid.
- `npm run test:db:down` — **exit 0**; disposable test database containers/network removed.
- `npm test -- --runInBand src/client-report/client-report.controller.e2e.spec.ts src/client-report/verified-briefing.spec.ts src/client-report/client-report.service.security.spec.ts src/client-report/report-generator.service.spec.ts src/billing/billing-role.guard.spec.ts` — **exit 0**, 5 suites and 22 tests passed. Includes no-data/stale facts, absent values, PII, hostile markup/instructions, unsupported sentences/numbers, guessed cross-workspace IDs, member role denial, forged workspace input, explicit consent, feature-off and duplicate approval.
- `npm run typecheck` in `backend-nest` — **exit 0**.
- `npm run typecheck` in `frontend` — **exit 0**.
- Targeted backend ESLint on client-report source/spec files — **exit 0**.
- Targeted frontend ESLint on the dashboard and route — **exit 0**, with two warnings: component length and effect-triggered fetch state update.
- `npx eslint src/lib/api-client.ts` — **exit 1** on existing `no-explicit-any` findings at lines 269 and 300, outside the new client-report API methods (which are near line 680). No changes were made to that unrelated mapper code.
- `git diff --check` — **exit 0**; Git emitted line-ending conversion warnings for files already changed in the checkout.

Test fixtures use fictional workspaces, projects, values and `.test` email addresses. No provider key is needed. Nest API tests use mock auth/DB/email; they do not send mail or connect to a live provider.

## Manual smoke steps

1. Start the local backend/frontend and disposable test DB. Keep `CLIENT_BRIEFINGS_ENABLED` unset and verify the feature endpoint returns `enabled: false`, approval is unavailable, and ordinary report drafts still load.
2. In a local-only environment set `CLIENT_BRIEFINGS_ENABLED=true`; sign in as an agency OWNER/ADMIN and create a draft with a fictional project. Verify fresh fixture facts show source/unit/as-of; with stale or missing data verify the explicit insufficient-data state and no zero values.
3. Edit the draft, add an unsupported numeric claim and verify approval fails; then use the exact `Human note (unverified):` prefix and verify non-numeric text is visibly identified. Numeric values must still match a source fact.
4. Approve without notification and confirm no email is sent. For notification, enter a consent note, inspect local mail transport output only, and confirm audit metadata records the actor and consent. Do not use real client recipients for this smoke test.
5. Try a guessed report ID from a second workspace and a non-owner role; both must be denied/not found. Retry the same approval and confirm a conflict with one approval audit event.

## Security, tenant review and data privacy

Controller-level JWT, agency and billing-role guards are applied to the feature. The workspace ID on create comes from the authenticated principal rather than request input; project IDs are checked against that workspace. Report queries and conditional mutations always include `workspaceId`. Tests cover another tenant's guessed report/project IDs, member role denial, workspace-path mismatch, and repeat approval.

The report may hold client names, project figures and recipient addresses in the existing report table. No briefing fields are sent to an LLM or external analytics. Emails are only attempted after explicit owner/admin consent and are rendered with HTML escaping and email/phone redaction. Audit metadata captures consent; it should be treated as sensitive operational data. Keep fixture recipient data fictional.

## Rollback

Disable the feature (`CLIENT_BRIEFINGS_ENABLED` unset/false) first. Keep the additive enum value and audit records; do not attempt to remove an enum member in place. If rolling back application code, ensure no `APPROVED` records are passed to code that does not understand the state. If the old scheduled sender is restored, first pause that job or move pending `SCHEDULED` rows to `DRAFT`/`FAILED` under an approved maintenance procedure so rollback cannot silently email clients. Preserve all `SENT` rows and approval audit events. No production migration or setting was changed in this task.

## Unverified assumptions and limits

- `ProjectProfitability.lastCalculatedAt` / `Project.updatedAt` is used as the best available freshness indicator; the current tables do not prove lineage to a specific provider observation. Source references are field identifiers, not immutable source-record IDs. Do not market these facts as provider-verified until Phase 09 provenance references are wired into this report.
- Real JWT/browser navigation, live SMTP delivery, actual email deliverability, deployment configuration and production records were not tested. Manual smoke steps remain to be run locally by an operator.
- Client notification idempotency is protected against duplicate approval requests by the atomic DRAFT→APPROVED transition. A crash after SMTP accepts a message but before status is updated can leave an approved item whose delivery outcome needs operator reconciliation; this implementation intentionally does not automatically retry and risk a duplicate email.
- The API client file still has two unrelated lint errors described above. Frontend component lint has non-blocking warnings.

## Next phase

Before Phase 17, run the local manual smoke flow with fictional data and confirm the exact source/freshness semantics with the Phase 09 metric-provenance owner. Resolve the two pre-existing `api-client.ts` lint errors in their owning change. Live SMTP verification, if desired, must use an explicitly authorized staging account and fictional recipient only.
