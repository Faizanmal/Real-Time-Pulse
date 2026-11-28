# Phase 09 — Metric provenance and quality

**Status: PASS (local implementation, mocked contracts and disposable database checks); live provider verification remains unverified.**

## Existing state and evidence inventory

The implementation was audited before adding the metric workflow. The repository already had:

- Workspace, provider integration, normalized sync record and sync run models in `backend-nest/prisma/schema.prisma` (Workspace line 130; Integration line 262; SyncRecord line 314; SyncRun line 328). Phase 08 sync records contain a provider-safe GitHub issue projection and a durable cursor/lease path, not a canonical metric contract.
- Portal and widget ownership relationships in `backend-nest/prisma/schema.prisma` (Portal line 679; Widget line 735). There was no metric definition, normalized observation, snapshot, client KPI mapping or milestone model.
- Data validation and source health foundations in `backend-nest/prisma/schema.prisma` (DataSourceHealth line 2070; DataValidationRule line 2148) and legacy source mappings at DataMapping line 3181. These were not canonical KPI definitions or portal-scoped snapshots.
- An existing authenticated Analytics controller/module/service (`backend-nest/src/analytics/analytics.controller.ts:14-15`, `backend-nest/src/analytics/analytics.module.ts`, `backend-nest/src/analytics/analytics.service.ts`). The controller scopes existing analytics to the authenticated workspace. It has been extended instead of introducing a duplicate module.
- The generic analytics engine returns zero for an empty aggregation (`backend-nest/src/analytics/analytics.engine.ts:291`), which is unsuitable for missing canonical observations. The new path uses nullable values and explicit quality/limitations.
- A deliberately small public portal view in `backend-nest/src/portals/portal.service.ts:158-202`; the protected share-link response is built in `backend-nest/src/share-links/share-links.service.ts:355-414`. Both paths now expose only portal-bound metrics explicitly marked client-visible.
- The agency analytics page had overview/performance/activity/trending loads and loading UI (`frontend/src/app/dashboard/analytics/page.tsx`); it had no client KPI mapping workflow.
- Existing sync freshness/queue observability is already available from `backend-nest/src/integrations/integration.controller.ts:53` and `backend-nest/src/integrations/integration.service.ts:219`. Phase 09 consumes sync timestamps and adds stale feed state to metric views.

The worktree had extensive uncommitted Phase 08 and other changes before this phase. Those changes were preserved; this report only attributes the files listed below to Phase 09.

## Scoped plan and design decision

The scoped plan was additive: extend the existing Prisma schema and Analytics service; materialize source and normalized observations from the existing GitHub sync worker; create portal-scoped KPI mappings/snapshots/milestones; expose workspace-authenticated agency controls and client-safe portal responses; add the mapping UI, fixture tests and this report.

### ADR — canonical snapshot model

1. Keep provider data, normalized values and derived snapshots in separate tables. Source observations contain only an allowlisted provider projection, a content/schema fingerprint and source timestamps. A stable source-version key makes replay idempotent.
2. Register only static, versioned transforms. No user-supplied code, `eval`, or implicit coercion is permitted. The safe unit registry allows explicit time conversions (seconds/milliseconds/minutes/hours) and rejects unrelated units; current GitHub metrics use identity count units. Aggregation is selected from the declared SUM/AVG/MIN/MAX/COUNT/LAST enum and rejects mixed units or non-identical periods. Current fixed GitHub metrics are `Open issues` and `Issue comments`; definitions state source, entity, grain, unit, aggregation, time zone, daily snapshot period, definition, owner, sensitivity and transform version.
3. A snapshot represents current provider issue state as of the daily sample window; inputs include each issue’s latest immutable source version, including records unchanged that day. Results are not growth or attribution claims. Unknown provider values are marked `SCHEMA_CHANGED`; absent valid samples remain `null`/`MISSING`, never numeric zero. Partial snapshots explain excluded observations.
4. A mapping belongs to one `(workspace, portal, metric)` and names one workspace integration. The agency-role guard and service ownership checks reject IDs outside the current workspace. Client responses query by the exact validated portal ID and require `clientVisible=true`; source IDs require the separate `allowSourceDrilldown=true` switch.
5. Daily snapshots use the definition’s IANA time zone. Upserts are unique by mapping, period and calculation version; snapshot/source joins update transactionally. Existing worker run idempotency/leases remain the outer duplicate-delivery boundary. Reprocess is an explicit reasoned, actor-attributed audit run over locally stored sync records and does not call a provider.
6. Operational freshness is stale when no successful source sync exists or the last sync is older than 24 hours. The displayed confidence is a completeness heuristic (`1` complete, `.75` partial), not a statistical confidence interval.

## Modified files

- `backend-nest/prisma/schema.prisma`
- `backend-nest/prisma/migrations/20261125152413_metric_provenance_quality/migration.sql`
- `backend-nest/src/analytics/metric-provenance.service.ts`
- `backend-nest/src/analytics/metric-provenance.service.spec.ts`
- `backend-nest/src/analytics/analytics.controller.ts`
- `backend-nest/src/analytics/analytics.module.ts`
- `backend-nest/src/jobs/jobs.module.ts`
- `backend-nest/src/jobs/processors/data-sync-queue.processor.ts`
- `backend-nest/src/jobs/processors/data-sync-queue.processor.spec.ts`
- `backend-nest/src/analytics/metric-provenance.integration.spec.ts`
- `backend-nest/prisma/seed-test-fixtures.ts`
- `backend-nest/scripts/test-db-runner.cjs`
- `backend-nest/src/portals/portal.module.ts`
- `backend-nest/src/portals/portal.service.ts`
- `backend-nest/src/portals/dto/portal.dto.ts`
- `backend-nest/src/share-links/share-links.module.ts`
- `backend-nest/src/share-links/share-links.service.ts`
- `frontend/src/components/analytics/MetricMappingManager.tsx`
- `frontend/src/app/dashboard/analytics/page.tsx`
- `frontend/src/app/v/[shareToken]/page.tsx`
- `frontend/src/app/share/[token]/page.tsx`
- `frontend/src/lib/api/analytics.ts`
- `frontend/src/types/index.ts`
- `docs/agent-execution/09-metric-provenance-quality.md`

## API and UI contracts

The existing `/analytics` controller is JWT-protected. The metric catalog, mapping list, mapping create, milestone create and reprocess routes additionally use `AgencyRoleGuard`:

- `GET /api/v1/analytics/metric-catalog` — workspace catalog; seeds the fixed supported definitions idempotently.
- `GET /api/v1/analytics/metric-mappings` — workspace mappings with latest snapshot, milestones, provider sync timestamp and stale/connection health.
- `POST /api/v1/analytics/metric-mappings` — `{ portalId, integrationId, metricDefinitionId, displayName, clientVisible?, allowSourceDrilldown?, targetValue?, targetUnit? }`. The service verifies all three resources against the authenticated workspace and enforces source provider and target unit compatibility.
- `POST /api/v1/analytics/metric-mappings/:id/milestones` — `{ name, description?, targetValue, targetDate }`; the mapping is workspace-scoped and the numeric target uses its declared metric unit.
- `POST /api/v1/analytics/metric-mappings/:id/reprocess` — `{ reason }`; records actor, reason, transform version, status and resulting snapshot (or a non-sensitive error code).

Both public portal response shapes include an optional `metrics` array. Each visible metric carries its source/provider, daily time range and time zone, nullable value and unit, formula/version, quality, completeness heuristic, limitations, last calculation time, source sync time and feed health. Source record identifiers are omitted unless drilldown is enabled. The pages show `Unavailable` for null values and render source details only when returned by the permission-filtered API.

The agency dashboard adds portal/provider/definition selection, client label, visibility/drilldown toggles, mapping list, milestone creation, audited reprocess and refresh. It has loading, retryable error and empty states. No fake growth or attribution fields were added.

## Migration and compatibility notes

Migration `20261125152413_metric_provenance_quality` is additive: it creates four enums and the metric definition/source observation/normalized observation/mapping/milestone/snapshot/source-join/reprocess tables, plus unique and lookup indexes. It does not rewrite or delete existing provider records. No existing API response field was removed; public `metrics` is additive/optional.

Prisma initially proposed dropping nine indexes created by prior migrations because those historical SQL indexes are not represented in the current Prisma model declarations. Those unrelated `DROP INDEX` statements were removed from this migration. The checked-in Phase 09 migration was applied to the disposable local database after that review. Existing `SyncRecord` rows are replayed locally when an agency creates a mapping; the normal sync worker materializes future versions. There is no automatic global backfill and no provider request in the mapping/reprocess replay path.

Rollback is application-first: disable/roll back the new UI/routes/worker hook and retain the new tables. Do not drop these additive tables during rollback; preserving their observations and audit history avoids data loss. A later cleanup/drop migration would require a separate explicit retention decision. No production database or setting was changed.

## Test commands and actual outcomes

Commands below ran from `backend-nest` or `frontend` as indicated. Exit codes are the observed final process statuses.

| Command | Result |
|---|---|
| `npm run prisma:validate` (`backend-nest`) | exit 0 — schema valid |
| `npm run typecheck` (`backend-nest`) | exit 0 — `tsc --noEmit` |
| `npx tsc --noEmit` (`frontend`) | exit 0 |
| `npm run build` (`backend-nest`) | exit 0 — Nest production compilation |
| `npm run build` (`frontend`) | exit 1 — Next.js Turbopack failed to spawn its CSS processing child while writing `/page` |
| `npx next build --webpack` (`frontend`, local elevated build process) | exit 0 — production bundle compiled, TypeScript passed, 61 static pages generated, `/dashboard/analytics`, `/share/[token]` and `/v/[shareToken]` included |
| `npm test -- --runInBand src/analytics/metric-provenance.service.spec.ts src/jobs/processors/data-sync-queue.processor.spec.ts` (`backend-nest`) | exit 0 — 2 suites, 16 tests passed |
| `$env:DATABASE_URL='<loopback test URL>'; npm run prisma:migrate -- --create-only --name metric_provenance_quality` (`backend-nest`) | exit 0 — generated the additive migration against `pulse_test` only |
| `npm run test:db:up` (`backend-nest`) | first sandbox attempt exit 1 (`permission denied` to Docker Desktop npipe); rerun with Docker permission exit 0 — local PostgreSQL/Redis healthy |
| `$env:TEST_DATABASE_URL='<loopback test URL>'; npm run test:integration` (`backend-nest`) | exit 0 — all 17 migrations applied to fresh `pulse_test`, fictional two-tenant/GitHub fixtures created, 2 database integration suites / 3 tests passed |
| `npm run test:db:down` (`backend-nest`) | exit 0 — disposable PostgreSQL/Redis containers and network removed |
| `node ./node_modules/eslint/bin/eslint.js src/analytics/metric-provenance.service.ts src/analytics/metric-provenance.service.spec.ts src/analytics/analytics.controller.ts src/analytics/analytics.module.ts` (`backend-nest`) | exit 0 — 0 errors, 1 test-mock `require-await` warning |
| `npx eslint src/components/analytics/MetricMappingManager.tsx src/lib/api/analytics.ts src/types/index.ts "src/app/v/[shareToken]/page.tsx" "src/app/share/[token]/page.tsx"` (`frontend`) | exit 0 — 0 errors, 8 warnings (component/page size and effect patterns) |

No test used actual GitHub credentials or contacted a live provider. The time-zone fixture exercises the 2025 New York spring-forward day (23-hour local day); other unit fixtures cover null values, provider schema fingerprint changes by field type, unsupported provider state, duplicate source delivery, rounding, unit conversion, incompatible units/periods, stale threshold, permission denial, cross-workspace IDs, same-workspace shared provider account isolation, visibility gating and reprocess audit fields. The existing worker fixtures cover incremental cursor, pagination, partial failure/restart, full backfill, lease conflict and duplicate job delivery.

## Manual smoke steps

1. From `backend-nest`, run `npm run test:db:up`, set `TEST_DATABASE_URL` to `postgresql://pulse_test:pulse_test_only_password@127.0.0.1:55432/pulse_test?schema=public`, then run `npm run test:db:migrate` and `npm run test:db:seed`. The seed creates client portals `00000000-0000-4000-8000-000000000032` and `00000000-0000-4000-8000-000000000033` in one workspace, a shared integration `00000000-0000-4000-8000-000000000043`, and three fictional issue rows. Its token is `FIXTURE_ONLY_NOT_A_REAL_TOKEN`.
2. Start the local backend and frontend against that isolated database and local Redis. Do not trigger the ordinary GitHub sync endpoint: the fixture token is intentionally invalid and no external provider call is part of this smoke.
3. Sign in as the fictional Northstar owner (`owner@northstar.invalid`, password printed by `npm run test:db:seed`), open Dashboard → Analytics, confirm catalog and portal/provider selectors load, create a portal-scoped metric mapping, set it agency-only, then create a milestone and invoke reprocess with an audit reason.
4. Confirm the agency view shows value/quality, source sync age, feed state and last calculation. A second reprocess for the same daily period should update the unique snapshot instead of creating another metric snapshot.
5. Mark the mapping client-visible and open the fixture portal using its generated `shareToken` at `/v/<shareToken>`. Confirm source, daily period/time zone, calculation, confidence caveat, limitations, freshness and health are shown. Verify source IDs stay hidden with drilldown off and appear only when it is explicitly on.
6. Try an ID from the second fixture tenant in the protected mapping/reprocess routes and confirm it is rejected; sign in as a `MEMBER` and confirm agency metric controls are denied.
7. Stop the local containers with `npm run test:db:down`.

These browser/API smoke steps were documented but not performed in this run.

## Security, tenant and privacy review

- Agency metric routes inherit JWT authentication and add the existing agency-role policy (client `MEMBER` accounts use assigned share links, not agency configuration endpoints).
- Mapping creation queries portal, integration and metric definition with the authenticated `workspaceId`; missing/cross-tenant IDs return not found. Milestone and reprocess lookups scope mapping IDs by workspace. Client reads are scoped to the portal ID obtained from the validated public portal token or validated share-link flow and filter `clientVisible=true`.
- Sharing one provider account across clients does not broaden metric access: each mapping references one portal and public reads use that portal; another tenant’s portal ID is never accepted by the mapping service.
- Stored source payload includes only `state` and numeric `comments`; external provider record ID is kept as the immutable reference. OAuth tokens, URLs, usernames, emails, labels and free-form body text are excluded. `_sourceSchemaHash` stores a SHA-256 fingerprint of provider field names/types, not source values.
- Drilldown source IDs are potentially identifying provider metadata and remain hidden by default. Only client-visible mappings with explicit `allowSourceDrilldown` return them. No provider credentials are required by contract tests.

## Unverified assumptions and limitations

- GitHub is the only fixed provider adapter implemented for canonical metrics in this phase. Other catalog providers/transforms, live GitHub schema behavior and actual provider-account pagination were not verified.
- The checked fixtures exercise the GitHub worker and the transformation contract separately; no end-to-end browser run against a live or real provider account was performed.
- The current 24-hour stale threshold and completeness-to-confidence scores are policy heuristics. The owner should approve these semantics before using the scores for client reporting.
- The current sample is a daily snapshot of current known issue state. It does not claim daily issue creation/closure rates, historical provider state reconstruction, business attribution or provider-side deletions absent from the sync record set.
- Existing dirty worktree changes outside the Phase 09 file list remain as found; they were not reverted or classified as part of this work.

## Before Phase 10

Agree on the canonical catalog ownership and stale threshold, review the additive migration and sample-period semantics, then run the documented browser/API smoke against a local fixture GitHub connector. Phase 10 should add another provider only with a fixed schema fixture, versioned allowlisted transform and the same tenant/idempotency contract tests. Live GitHub verification requires an authorized test account and should be a separately gated action.
