# Phase 13 — Agency command center

**Status: PASS with verification limits.** The overview-to-blocker workflow, bounded list/attention pagination, safe bulk unpublish, database-backed billing role enforcement, and audit calls are implemented and covered by targeted tests and browser smoke. No schema change or production action was made. Whole-repository lint is not clean, and audit persistence is best-effort in the existing audit service; see limits below.

## Existing state and evidence inventory

- `frontend/src/app/dashboard/page.tsx:93–100` previously requested a fixed first page (20 portals); its filtering was local (`:175`) and the portal cards began around `:804`. There was no server-backed attention queue or paging controls.
- `backend-nest/src/portals/portal.service.ts:439–468` already implemented workspace-scoped portal listing with a total count. `backend-nest/src/portals/portal.controller.ts:47–56` accepted page parameters without service-level bounds.
- `backend-nest/prisma/schema.prisma:700–704` already stored client status fields. `Portal` also already had a workspace/deleted index, so this change did not need a new table/index or migration.
- Existing workspace/member changes checked OWNER/ADMIN in the workspace service. Portal unpublish had an owner/admin check. Billing routes used `AgencyRoleGuard`, which only rejected MEMBER; the billing write path lacked a fresh database role check.
- `AuditInterceptor` only records decorated handlers and there were no command-center `@AuditLog` uses. Portal service already had access to workspace-scoped mutations; the new command operation writes through the existing audit service.
- Existing data model and API were reused. No duplicate command-center module was added.

## Scoped design / ADR

Reuse the current portal data and dashboard. Add a small, bounded, workspace-scoped attention query rather than introduce a separate command-center domain. Additive response metadata preserves the existing list response. Bulk unpublish is the only bulk action: it is reversible by republishing, requires explicit UI confirmation, is capped at 50 IDs, deduplicates repeated IDs, conditionally updates only public, non-deleted portals in the caller workspace, and returns counts without disclosing unavailable foreign IDs. No bulk delete was introduced.

For billing mutations, use a dedicated guard that checks the user’s current database role and workspace on each write. This prevents an old JWT role claim from granting billing access after a role change. No authorization is inferred from a client-provided scope.

The overview includes a paginated attention queue with direct review links. Each item shows status, status note or pending decision, and last update time. The operator can reach the edit screen in one click from the overview, then resolve the decision and save. Lists expose totals and page controls. Errors have retry paths; empty queue/list states are explicit.

## Modified files

- `backend-nest/src/portals/portal.service.ts` — bounded pagination, narrow attention query, idempotent conditional unpublish, bulk unpublish and audit metadata.
- `backend-nest/src/portals/portal.controller.ts` — guarded attention and bulk-unpublish endpoints; existing list pagination routes to bounded service behavior.
- `backend-nest/src/portals/portal.module.ts` — imports audit capability.
- `backend-nest/src/billing/billing-role.guard.ts` — new database-backed OWNER/ADMIN guard.
- `backend-nest/src/billing/billing-role.guard.spec.ts` — role freshness/denial tests.
- `backend-nest/src/billing/billing.controller.ts`, `billing.module.ts` — applies/provides the billing guard on write/session mutations.
- `backend-nest/src/portals/portal.command-center.spec.ts` — pagination/query shape, cross-tenant denial, role denial, caps, duplicate/replay, stale/foreign IDs, and audit behavior.
- `frontend/src/lib/api-client.ts` — attention and bulk action contracts.
- `frontend/src/app/dashboard/page.tsx` — command-center queue, paging, loading/error/empty states, review links, and confirmed bulk action reconciliation.
- `e2e/tests/smoke.spec.ts` — integration contracts and overview blocker-resolution journey.
- `docs/agent-execution/13-agency-command-center.md` — this execution report.

The worktree contains many unrelated changes from preceding phases. They were preserved and are not attributed to this phase.

## Migration and compatibility notes

No database schema or data migration is required. Portal list response retains `portals` and `total` and adds `page`/`pageSize`. Attention and bulk-unpublish endpoints are additive. Bulk response includes requested/succeeded/unavailable counts and successful own-workspace IDs so the UI can reconcile only confirmed changes. Existing unpublish remains available and is idempotent. No rollout flag or backfill is needed. Rollback is code-only (revert the phase files); no data repair is needed. Already unpublished portals remain unpublished if code is rolled back.

## API and UI contracts

- `GET /api/v1/portals?page=&pageSize=` — existing workspace-scoped portal page, now clamps page to at least 1 and page size to 1–100; response retains `{ portals, total }` and adds `{ page, pageSize }`.
- `GET /api/v1/portals/attention?page=&pageSize=` — authenticated workspace-scoped page, max size 20. Only summary fields are selected; share tokens and published snapshots are excluded. It returns blocker or pending-decision items and pagination metadata.
- `POST /api/v1/portals/bulk-unpublish` with `{ portalIds: string[] }` — authenticated; caller must be OWNER/ADMIN; 1–50 IDs. Duplicate IDs count once. Foreign, deleted, already-private, and stale IDs are reported only as unavailable counts, never echoed.
- Bulk UI prompts before execution, disables repeated submit during the operation, removes confirmed successes, refreshes stale/partial results and displays success/unavailable counts. A failed request shows an error and reload/retry path. Search/filter applies to the currently loaded page. No loading skeleton was added; loading state is indicated by the existing dashboard loading treatment.
- Billing write/session routes check the current principal, workspace ID, and database role in `{ OWNER, ADMIN }` before calling billing service logic.

## Verification and actual command outcomes

Commands ran locally using fictional fixture data and the repository’s disposable test stack; no real provider credentials or live Stripe calls were used.

- `backend-nest`: `npm run typecheck -- --pretty false` — **exit 0**.
- `frontend`: `npm run typecheck -- --pretty false` — **exit 0**.
- `backend-nest`: `node ./scripts/prisma-runner.cjs validate` — **exit 0**; no migration was generated.
- `backend-nest`: `npm test -- --runInBand src/portals/portal.command-center.spec.ts src/billing/billing-role.guard.spec.ts src/portals/portal.service.tenant.spec.ts src/portals/portal.service.publish.spec.ts src/portals/portal.service.spec.ts` — **exit 0**, 5 suites / 20 tests passed.
- `e2e`: `npm run test:smoke -- --grep "command center resolves a client blocker"` — **exit 0**, 1 browser test passed.
- `e2e`: `npm run test:smoke -- --grep "agency creates persistent client portal"` — **exit 0**, 1 integrated browser test passed. It includes bounded paging, summary-field exposure, member billing denial, duplicate/replayed bulk action, and revoked-session behavior.
- `git diff --check` — **exit 0** (line-ending conversion warnings from the existing worktree only).
- `backend-nest`: `npx eslint src/billing/billing-role.guard.ts src/billing/billing-role.guard.spec.ts src/portals/portal.command-center.spec.ts` — **exit 0**.
- `frontend`: `npx eslint src/app/dashboard/page.tsx` — **exit 0**, 0 errors and 5 warnings (existing dashboard size/complexity, effect state calls, and JSX prop spread).
- After a final type-only test fixture cleanup, `backend-nest`: `npm run typecheck -- --pretty false` followed by `npm test -- --runInBand src/portals/portal.command-center.spec.ts src/billing/billing-role.guard.spec.ts` — **exit 0**, 2 suites / 8 tests passed.
- Broader lint runs earlier in the work found existing errors in unrelated/previous-phase files (including `no-explicit-any` in `frontend/src/lib/api-client.ts` around lines 268 and 299, and formatting/type-lint findings across existing backend files). The broad lint command therefore exited nonzero. No repository-wide lint-clean claim is made.
- An exploratory billing service unit suite was not a release gate because it depends on configured Stripe and a complete Prisma mock; that setup was not available. Billing access denial was instead covered through the mock-backed guard test and integrated browser/API check.

### Performance evidence

The attention query issues one bounded `findMany` and one `count` independent of the 200-record fixture size; the command-center unit test asserts exactly one of each and a page of five. This guards against N+1 query growth for the attention list. It is a query-count contract, not a latency benchmark against a production-sized database. The list page is capped at 100 and the UI requests 20.

## Manual smoke steps

1. Start the local app with the fictional seeded workspace and sign in as its owner/admin.
2. Create or select a fictional portal, set its client status to BLOCKED with a pending decision, and save.
3. Return to the overview; verify the attention row includes the decision and last-updated time. Click **Review**, resolve the blocker, clear the pending decision, and save. The item should leave the queue after refresh.
4. Seed more than 20 fictional portals and verify list/attention page controls and totals. Search is scoped to the current page.
5. Select a public portal and bulk-unpublish it. Confirm the dialog; verify successful count and that it is no longer public. Replay the same request; it should report unavailable/no new side effects.
6. Sign in as a MEMBER and attempt billing write/session routes and bulk unpublish; each should be denied. Attempt a foreign workspace portal ID; the response must not disclose its existence.

## Security, tenant and privacy review

Attention reads require portal controller authentication and verify the caller’s workspace membership in service code. Mutations scope IDs by workspace and non-deleted state, and only select public resources for update. Bulk writes independently check the current database OWNER/ADMIN role. Billing writes check the current database role and exact workspace. Tests include another tenant’s portal ID and MEMBER role denial. Attention selects a narrow set of fields and excludes share tokens, snapshots, credentials, and workspace IDs. Audit metadata contains operation/counts and only successful same-workspace portal IDs; client notes and credentials are not copied into audit values.

Existing `AuditService.log` is best-effort and swallows persistence failures. Therefore audit calls are made on successful operations and covered in tests, but durable audit storage during an audit database outage is not guaranteed. This should be hardened if command audit is a regulatory/financial requirement.

## Data privacy

All test records and emails use `.test` fictional identities. No live provider or billing account was accessed. Attention response does not expose private publication data. Audit logs contain actor/action/resource identifiers already used by the product audit facility; retention follows the existing audit policy.

## Rollback

Revert the listed Phase 13 code and E2E changes. There is no schema migration to reverse. The only lasting business state is a portal’s intended `isPublic=false` state after operator-confirmed unpublish; rolling back code does not republish it. Re-publish explicitly through the existing authorized workflow if needed.

## Unverified assumptions and limits

- Live Stripe behavior and role transitions with a real provider account were intentionally not exercised.
- The attention queue is an operational overview of portal client status/pending decisions; it does not synthesize blockers from connector errors or billing state.
- Performance was measured by fixed query count and bounded response size, not by load testing latency at hundreds of clients.
- Existing audit persistence is best-effort as described above.
- Existing API client integration-summary requests appear to use a duplicated `/v1` segment (`frontend/src/lib/api-client.ts` around line 299) and can fail independently of the command-center flow; it was not changed in this phase.
- Final targeted lint command results must be appended below when the current lint processes finish.

## Before the next phase

Review the best-effort audit limitation and decide whether it needs durable failure handling before any compliance-sensitive bulk operations. Then proceed to Phase 14 with a local review of the overview against a representative 100+ client fixture; keep live billing/provider verification gated to an explicitly authorized environment.

## Final verification note

Targeted ESLint completed with the outcomes above. Frontend lint reports warnings but no errors. The broader lint findings remain as previously described.
