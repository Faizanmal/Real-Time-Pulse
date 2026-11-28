# 08 — Sync freshness

**Status: PASS — implementation, fixed-provider fixtures, isolated migration, database integration test, and webpack production build passed.**

## Existing state

- `backend-nest/prisma/schema.prisma:258-286` already had integration health fields (`lastSyncedAt`, `lastValidDataAt`, `lastSyncError`, `connectionState`) but no durable provider cursor or sync-record store.
- `backend-nest/src/integrations/integration.service.ts:165-181,257-265` already listed feeds by workspace, asserted connector ownership, and queued `full`/`incremental` jobs. `backend-nest/src/integrations/integration.controller.ts:22-25,48-51,83-85` had JWT/agency-role guards and connector ownership checks.
- `backend-nest/src/jobs/jobs.service.ts:85-109` already scanned waiting/active jobs to reduce duplicates and configured three attempts, but did not have a stable request key for duplicate enqueue calls.
- `backend-nest/src/jobs/processors/data-sync-queue.processor.ts:20-53` validated connector/workspace and then always failed with “Paginated connector sync is not configured.” It did not fetch provider pages or advance a cursor.
- The Integrations page already handled connector list loading, empty and error states, but did not expose per-feed freshness or queue operations.

## Design / ADR

Extend the existing integration and Bull queue path. Add a nullable provider cursor to `Integration`, durable sync run records keyed by integration plus Bull job ID, and durable normalized provider records unique by `(integrationId, externalId)`. For GitHub, fetch issues using the authenticated user's `/user/issues` endpoint by default, or a configured `settings.sync.owner/repo` pair for one repository. Follow the GitHub `Link` next-page URL; absent a Link header, request a subsequent page only when the current page is full.

Each fetched page commits record upserts, the next cursor, and run counters in one database transaction. The cursor retains the current page and watermark. A failed page leaves the previous page checkpoint intact; a restarted retry resumes that page. Incremental requests include a one-millisecond overlap before the watermark, with stable record IDs making overlap safe. Full sync begins at page one without `since`. A `complete` checkpoint lets a restarted worker finalize a run without re-fetching its final committed page. A 60-second database lease prevents concurrent workers from owning the same run. Completed job IDs are ignored; unique record keys make provider-record effects idempotent. Failure events are broadcast only on the final configured attempt; success is broadcast only after completion.

Dry-run returns a plan and makes no queue or provider call. Full replay creates a fresh request ID; a repeated request ID maps to the same Bull job ID. Freshness is derived from the last valid data time with an initial 24-hour stale threshold. Queue age/depth/retry counts are workspace-filtered. Current metrics sample the newest 500 jobs per state and can undercount a larger retained backlog.

## Modified files

- `backend-nest/prisma/schema.prisma` — `syncCursor`, `SyncRun`, and `SyncRecord` schema.
- `backend-nest/prisma/migrations/20261125130000_sync_freshness_checkpoint/migration.sql` — additive cursor, run, and record tables, unique constraints, indexes, and cascade relations.
- `backend-nest/src/jobs/sync-provider.service.ts` — fixed-provider GitHub issues pagination adapter.
- `backend-nest/src/jobs/jobs.module.ts` — registers the HTTP-backed sync adapter.
- `backend-nest/src/jobs/jobs.service.ts` — stable idempotency job IDs, exponential retries, and workspace-scoped queue metrics.
- `backend-nest/src/jobs/processors/data-sync-queue.processor.ts` — leased, checkpointed, transactional sync, normalized record upserts, progress, retry/error state, and completion events.
- `backend-nest/src/integrations/integration.service.ts` — freshness projection and dry-run/replay request behavior.
- `backend-nest/src/integrations/integration.controller.ts` — authorized freshness route and optional `dryRun`/`requestId` sync contract.
- `frontend/src/lib/api-client.ts` and `frontend/src/app/dashboard/integrations/page.tsx` — freshness API, health/timestamps, run/queue metrics, and dry-run/replay controls.
- `backend-nest/src/jobs/processors/data-sync-queue.processor.spec.ts`, `backend-nest/src/jobs/sync-provider.service.spec.ts`, `backend-nest/src/jobs/jobs.service.sync-metrics.spec.ts`, `backend-nest/src/integrations/sync-freshness.spec.ts`, `backend-nest/src/integrations/integration.controller.sync-security.spec.ts` — provider, pagination, failure/restart, duplicate, retry, lease, freshness, and tenant fixtures.
- `docs/agent-execution/08-sync-freshness.md` — this phase record.

## Migration notes

The migration is additive. It adds nullable `integrations.syncCursor` without backfill, then creates empty run/record tables. Existing sync timestamps and integrations are unchanged. No existing provider data is rewritten. Deleting an integration cascades its new sync run/record rows, consistent with the existing integration lifecycle. The migration was applied successfully to the disposable loopback `pulse_test` database; the DB integration fixture passed afterward.

`prisma generate`, `prisma validate`, the full migration chain, and the database integration check succeeded. The database contained only local fictional fixtures. Do not run this migration against production as part of this phase.

Rollback: roll application code back while preserving the nullable column and new tables. Do not drop the new tables while they contain records/run history. After retention/export review and only against the intended database, a separate approved cleanup migration may drop them. No data backfill or reverse transform is needed.

## API and UI contracts

- `GET /v1/integrations/workspace/:workspaceId/sync-freshness` returns per-feed provider/health/last-updated/freshness age/error code/latest run plus workspace-filtered queue depth, active/failed/retry counts, per-state counts, oldest queued time/age, and metric timestamp. It returns no queue payloads or credentials.
- Health values are `ERROR`, `DEGRADED`, `NEVER_SYNCED`, `STALE`, or `HEALTHY`. The stale threshold is 24 hours.
- `POST /v1/integrations/:id/sync` still accepts `syncType: "full" | "incremental"`; additive options are `dryRun: true` and UUID `requestId`. Dry-run does no provider request and no enqueue. Reusing a request ID gives the same deterministic job ID; a new full replay uses a new ID.
- GitHub configuration may include `settings.sync: { owner, repo, perPage }`. Both owner and repo are required together. If omitted, the adapter reads the authenticated user's issues. Page size is clamped to 1–100.
- UI displays feed health, last-updated time, latest run status/count/error code, queue depth/active/failed/retries, oldest queue age, dry-run/replay controls, plus loading, empty, and error states.

## Test commands and actual output

- `backend-nest`: `npm test -- --runInBand --runTestsByPath src/integrations/sync-freshness.spec.ts src/integrations/integration.controller.sync-security.spec.ts src/jobs/jobs.service.sync-metrics.spec.ts src/jobs/sync-provider.service.spec.ts src/jobs/processors/data-sync-queue.processor.spec.ts` — **exit 0**, 5 suites passed, 14 tests passed.
- `backend-nest`: `npm run typecheck` — **exit 0**.
- `frontend`: `npm run typecheck` — **exit 0**.
- `backend-nest`: `node scripts/prisma-runner.cjs generate` — **exit 0**, Prisma Client generated.
- `backend-nest`: `npm run prisma:validate` — **exit 0**, Prisma schema valid.
- `backend-nest`: `npm run build` — **exit 0**.
- `backend-nest`: `npm run test:db:up` — **exit 0**, isolated PostgreSQL and Redis containers became healthy.
- `backend-nest`: `npm run test:db:migrate` with loopback-only `TEST_DATABASE_URL` — **exit 0**, all 16 migrations applied, including `20261125130000_sync_freshness_checkpoint`.
- `backend-nest`: `npm run test:integration` with the same `TEST_DATABASE_URL` — **exit 0**, 1 suite and 1 database tenant-isolation test passed; it generated and seeded fictional fixtures.
- `frontend`: `npm run build` — **exit 1** in the default Turbopack build because its CSS child process exited before connecting. `npx next build --webpack` — **exit 0**, compiled, typechecked, rendered all 61 routes, and collected build traces. The production build is verified through webpack.
- Fixture tests use fictional owners/repos, tokens, and issue records; no provider account or live credential was used.

## Manual smoke steps

1. Start the repository's isolated test Postgres/Redis services and apply migrations using `npm run test:db:up` and `npm run test:db:migrate`.
2. Start the local backend/frontend with a fixture workspace and a mock GitHub HTTP response source. No real token should be used.
3. Confirm initial cursor starts at page 1, incremental requests send the stored `since` watermark with the overlap, Link pagination advances page, and full backfill ignores the prior watermark.
4. Make page two fail once, restart the worker, then allow page two. Confirm page one is not fetched again, page two resumes, records are unique, and completion updates last-valid time.
5. Replay the same job/request ID after completion and confirm no provider fetch or repeated success event. Race two deliveries and confirm one acquires the lease.
6. Open Integrations and confirm health, timestamps, queue counts/age/retries, dry-run behavior, and replay controls. Verify dry-run creates neither HTTP calls nor queue jobs.
7. Call freshness with another workspace ID and replay with another workspace's connector ID; expect denial. Try a deleted connector ID; expect not found.

## Security / tenant review

JWT and agency-role guards remain in place. Workspace freshness compares the path workspace with the authenticated workspace. Connector replay retains `assertWorkspaceAccess`. Queue values are calculated only after filtering by the authenticated workspace ID from job data. Worker connector lookup uses both connector ID and workspace ID; all status writes use the same pair. Run and record rows are related to the integration, and record/run uniqueness is scoped to integration. A bounded DB lease protects concurrent deliveries. Tests cover another workspace's connector, stale connector ID, another workspace's freshness route, duplicate request/job completion, and lease contention.

No provider secrets are included in API metrics, events, or logs. The adapter sends tokens only in the GitHub Authorization header. Raw GitHub issue bodies, author details, email addresses, and URLs are not persisted; records retain ID, state, created/updated/closed timestamps, comment count, pull-request flag, and label names. The fixture test asserts body and email fields are omitted.

## Unverified assumptions and limits

- Live GitHub account/API behavior is unverified. The user-issues endpoint and repo-scoped optional path are covered with HTTP fixtures; no live key/account was required or used.
- The 24-hour stale threshold is an initial assumption, not an agreed provider-specific objective.
- Queue metrics sample at most 500 retained jobs per state. Large-backlog accuracy needs a bounded aggregate/counter strategy before SLO use.
- The paginated sync worker currently supports GitHub issues. Other configured providers are reported as `sync_not_configured` until their adapters are added.
- The default Turbopack build still fails in this environment; the equivalent webpack production build passes.

## Before the next phase

Proceed to phase 09. Before setting sync SLOs, confirm the 24-hour stale threshold and decide whether queue metrics need complete counts beyond the current 500-job-per-state sample. Add provider adapters for other integrations as their pagination contracts are selected. Live GitHub verification may be performed separately with an authorized test account; it is not required for these fixture-backed checks. Do not deploy or change production settings as part of this phase.
