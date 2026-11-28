# Phase 27 — Observability and SRE

**Status: BLOCKED for acceptance.** Operational documentation and safe local checks are complete, but there is no verified backup/PITR implementation or restore exercise, and the requested visible recovery-time/error-budget view is not implemented. No production system was accessed or changed.

## Existing state

- `backend-nest/src/health/health.controller.ts:13-63` exposes liveness/readiness checks; readiness checks Prisma and Redis. It does not report an SLO or error budget.
- `backend-nest/src/monitoring/metrics.controller.ts:14-49` exposes Prometheus metrics publicly and authenticated JSON/alert endpoints. Metrics are not a tenant/provider error-budget dashboard.
- `backend-nest/src/integrations/integration.controller.ts:24-26,53-58` applies JWT and agency-role guards and rejects a freshness query for a workspace other than the caller's workspace.
- `backend-nest/src/integrations/integration.service.ts:193-243` scopes integration and sync-run queries by workspace, and returns provider connection state, last valid data time/age, stale health, safe error code, latest run and queue metrics. Staleness is currently 24 hours. It does not return recovery duration or error budget.
- `frontend/src/app/dashboard/integrations/page.tsx:25-58,263-271` fetches the current workspace freshness data and renders loading, error/retry, empty, queue and provider freshness states. It lacks visible recovery duration and error budget.
- `backend-nest/src/jobs/processors/data-sync-queue.processor.ts:215-257` records failure/recovery signals. `backend-nest/src/alerts/alerts.service.ts` evaluates configured rules and resolves matching occurrences; without configured rules there is no guarantee an alert is emitted. `AlertHistory` in `backend-nest/prisma/schema.prisma:1401-1405` has status and trigger time but no persisted `resolvedAt`.
- Two separate backup implementations exist. The API implementation is `backend-nest/src/backup/backup.controller.ts:7-33` plus `backend-nest/src/backup/backup.service.ts`; a filesystem-oriented implementation is `backend-nest/src/common/services/backup.service.ts`. They are not safe substitutes for managed database backups.
- `backend-nest/src/backup/backup.controller.ts:7-33` protects global backup list/create/restore/PITR routes only with JWT and does not scope by workspace or require platform-operator authorization. `backend-nest/src/backup/backup.service.ts:31` uses a process-random fallback encryption key; `:60-82` snapshots application data and simulates replication; `:137-158` selects an application snapshot before a timestamp rather than replaying WAL; `:208-219` selects broad tables including integrations/users/workspaces; `:225-246` writes dashboard data during restore; `:280-295` logs simulated replication. No `Backup` Prisma model or migration-created `backups` table was found.
- The second implementation writes local files (`backend-nest/src/common/services/backup.service.ts:32-90`), has a constant fallback encryption key (`:223-229`), and its non-dry-run restore only logs intended record counts (`:294-348`).
- `backend-nest/docker-compose.yml:3-43` defines local Postgres/Redis volumes, not backup retention. `k8s/deployments.yaml:20-84` references the application DB secret but does not define managed database backup/PITR. Production provider, encryption/KMS, retention, RPO and RTO remain unverified.

## Scoped plan and design decision

The audit found an existing workspace-scoped freshness service/UI, so this phase does not add a duplicate observability module. It also found a global restore surface that could expose or mutate cross-tenant data. **ADR:** keep this phase documentation-only and do not call backup/list/restore routes or create an export. Describe the safer managed-backup-to-new-target drill and runbooks; leave product and production configuration unchanged. An implementation phase should first secure/disable global restore, establish backup ownership and an approved disposable target, then add persisted recovery timestamps and a tenant-scoped SLO/error-budget contract after owners define the SLO.

The proposed restore source is the database provider's managed encrypted snapshot/PITR capability, not application-level snapshot selection. Restore must target a new isolated resource, with production credentials and traffic excluded. Error budget must not be invented: its window, target, eligible events and burn thresholds require service-owner decisions.

## Modified files

- Added `docs/operations/backup-and-restore.md` with observed limitations, safe new-target restore procedure, rollback and verification status.
- Added `docs/operations/on-call-runbooks.md` covering provider outage, stale dashboard, OAuth outage, leaked key, bad migration, Stripe backlog and cloud incident.
- Added this execution report.
- No application source, schema, migrations, API/UI contract, production setting or data was changed in this phase.

## Migration notes

No schema migration was made. A future recovery-duration feature will need an additive, backward-compatible resolution timestamp/event and migration strategy; it must define duplicate/retry semantics and retain existing alert consumers. No database schema or migration validation was run for this docs-only phase.

## API and UI contracts

- Existing freshness contract remains `GET /api/v1/integrations/workspace/:workspaceId/sync-freshness`, restricted to the caller's workspace. It reports per-provider connection/freshness/error/latest-run and queue metrics; existing integration page handles loading/error/empty states. No fields or behavior changed.
- Health routes remain `/api/v1/health/live` and `/api/v1/health/ready`. No SLO/error-budget endpoint was added.
- Existing global backup routes include `POST /api/v1/backups`, `GET /api/v1/backups`, `POST /api/v1/backups/:id/restore`, and `POST /api/v1/backups/restore/point-in-time`. They remain unchanged and are unsafe for this exercise; do not use them.
- No UI/API contract was added for recovery duration or error budget. This is an acceptance gap, not a claimed feature.

## Test commands and actual output

Focused local provider, alert, freshness and queue metrics tests were run with fictional/mocked data:

```text
cd backend-nest
npx jest --runInBand --coverage=false src/jobs/processors/data-sync-queue.processor.spec.ts src/alerts/alerts.service.spec.ts src/integrations/sync-freshness.spec.ts src/jobs/jobs.service.sync-metrics.spec.ts src/jobs/sync-provider.service.spec.ts
```

**Exit code: 0.** 5 suites passed; 21 tests passed; 0 snapshots. These are unit tests, not an outage-to-notification-to-visible-recovery E2E or backup restore test.

Host capability probe found `postgres`, `initdb`, `pg_dump`, `pg_restore` and `psql` unavailable. The follow-on Windows service-manager probe exited 1 because access was denied; it does not establish whether a DB service exists. Docker-based disposable DB validation was unavailable in the environment. Therefore no restore drill was attempted. No provider credentials or live provider calls were used.

## Manual smoke and restore drill

Run the procedures in [backup-and-restore.md](../operations/backup-and-restore.md) and [on-call-runbooks.md](../operations/on-call-runbooks.md). The restore procedure is a plan, not an exercise record. Before a drill, provision and verify an isolated disposable target; use only fictional records; restore a managed backup to a new resource; check row counts/checksum, tenant separation, credential absence, elapsed recovery time and cleanup of the exact disposable resource. Do not point application traffic at it. Record actual timestamps and provider operation ID. A failed or unavailable check remains a failed/unverified drill.

## Security, tenant review and data privacy

The freshness path is workspace-filtered and its existing tests cover workspace scope and credential non-disclosure. The backup API presents a high-priority authorization concern: any JWT-authenticated user can reach global list/create/restore actions, and implementation queries broad cross-tenant data. This was code-reviewed only; no unauthorized request or restore was attempted. Before launch, restrict these endpoints to a dedicated platform-operator/break-glass principal, scope exports and backup metadata, audit every action, and make restore target explicit and allowlisted. Add negative tests for unauthenticated access, ordinary tenant user, another tenant's ID and a production target. Until then, do not expose the backup UI/routes to ordinary users.

Backups and incident artifacts can contain personal data and integration credentials. Store only in an approved encrypted provider, restrict access, redact tokens/payloads from logs and tickets, and apply documented retention/deletion. No real backup, customer export, secret, or provider account was accessed in this phase.

## Rollback

This phase changed documentation only; rollback is reverting the three added documentation files. No data, schema, external service or production setting was changed. For the future restore drill, rollback means deleting only the verified disposable target by exact resource ID; never overwrite or promote the source/production database.

## Unverified assumptions and acceptance gaps

- Production database provider/features, backup schedule, PITR/WAL coverage, encryption-at-rest/KMS, retention, immutability, RPO/RTO and restore permissions are unknown.
- Paging destination, staffed on-call ownership, provider status integrations and alert delivery are unknown.
- Synthetic outage detection/alert delivery and visible recovery time have not been demonstrated end-to-end.
- Tenant/provider error-budget dashboard is not implemented and no SLO has been specified.
- Disposable restore has not been performed; capacity/cost estimates cannot be grounded without provider, retention, database size, hardware and measured restore duration.
- No container scan or dependency audit was performed in this phase; no such result is claimed.

## Result and next phase gate

**BLOCKED — acceptance criteria not met.** The safe documentation and focused local tests are complete, but there is no actual disposable restore exercise, no verified encrypted/PITR backup, no outage-to-alert-and-visible-recovery demonstration, and no tenant/provider error-budget view. The global restore authorization boundary is a further launch blocker.

Before the next phase: (1) disable or restrict the global backup endpoints/UI and add negative authorization/tenant tests; (2) have the service owner identify the managed DB provider, approve RPO/RTO, encryption/retention and a disposable target; (3) perform and record a new-target restore drill; (4) define SLO/error-budget rules and instrument resolution timestamps; (5) implement and verify tenant-scoped synthetic outage alerting and visible recovery time; (6) run dependency and container scans in the owned disposable environment and record tool/version/output. No production rollout should occur until those gates pass.
