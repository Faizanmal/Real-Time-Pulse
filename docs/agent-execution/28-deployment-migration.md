# Phase 28 — Deployment and migration rollback readiness

**Status: BLOCKED for acceptance.** A rollback plan is prepared, and local Playwright test discovery passed. A staging deploy, smoke E2E run, migration rehearsal and deployment/rollback drill were not performed. No deployment or production setting was changed.

## Existing state

- `backend-nest/Dockerfile:2,25` builds and runs on floating `node:24-trixie-slim`; `:31-49` runs as non-root; `:52-59` exposes port 3000 and starts `node dist/main`. It has a Docker health check for `/api/health` on port 3000 (`:54-56`). The image has no release tag/digest pinning procedure in the Dockerfile.
- `k8s/deployments.yaml:21-27,61-75` deploys the backend as `realtime-pulse/backend:latest`, declares ports 3001/3002 and probes `/health` and `/health/ready`. Those port/path values do not match the Dockerfile's port 3000 `/api/health` check. Frontend and worker images are also mutable `:latest` (`:124-131,171-174`). API and worker therefore cannot be reproducibly rolled back to an identified artifact from this manifest.
- `k8s/deployments.yaml:31-45` injects backend database, Redis and JWT values from Kubernetes Secrets. The frontend API URL is embedded as a literal (`:129-131`). This describes secret references, not proof that staging secrets or cluster resources are provisioned.
- `backend-nest/docker-compose.yml:3-16,25-32` is explicitly local development and binds Postgres/Redis to loopback. It includes fictional/local credentials. `backend-nest/docker-compose.test.yml:3-13,20-24` uses disposable services and loopback ports. These are not production manifests.
- `backend-nest/package.json:36-50` provides Prisma validate/deploy and local/test migration commands. `backend-nest/prisma.config.ts:4-12` requires `DATABASE_URL`; `backend-nest/scripts/prisma-runner.cjs:1-22` delegates to the installed Prisma CLI. Prisma's deploy path applies pending migrations and this repository does not provide a general down-migration command.
- `.github/workflows/ci-cd.yml:253-294` contains a staging SSH deployment, Compose pull/up, migration and health check; `:296-340` contains a production deployment and a failure step that runs `docker-compose down` then `up -d`. This is not an image rollback to a recorded previous digest and does not reverse a migration. The workflow also has external SSH/Slack actions. It was inspected but never triggered.
- `.github/workflows/local-smoke.yml:14-57,59-144` layers static/unit, disposable DB integration and browser smoke jobs. The Playwright smoke config starts local API/frontend services, uses test-only credentials and loopback URLs (`e2e/playwright.smoke.config.ts:3-5,27-54`). It disables trace for auth flows (`:23-25`). The smoke test includes fictional agency/client personas (`e2e/tests/smoke.spec.ts:84`) and an explicit idempotent retry/other-workspace denial step (`:1021-1048`).
- `frontend/src/contexts/feature-flag-context.tsx:18-60` stores flags and defaults in browser localStorage. This is a presentation preference, not a server-enforced rollout/kill switch, and must not be used for authorization, data migrations, worker behavior or operational rollback.

## Scoped plan and design decision

The existing deployment and migration mechanisms were audited first. This phase is documentation-only: record a rollback order and safe staging rehearsal procedure; do not edit production deployment configuration, run CI/CD, mutate a database, or change flags. No duplicate release/migration module is introduced.

**ADR:** treat application, worker and schema as separate rollback units. Build immutable images and record digests for frontend, API and worker. Roll back API/worker/frontend independently to known prior digests, then verify health, queue behavior and the critical multi-persona smoke flow. Gate risky behavior server-side with a remotely controlled, auditable flag before rollout; existing localStorage flags are not an operational gate. Use expand-contract migrations so old and new application versions can both operate during the rollout. Do not assume a schema rollback is safe: prefer a reviewed forward fix; only recover data through a verified backup restored to a new isolated target. Phase 27's backup/restore implementation remains blocked, so production data rollback is not currently an approved option.

The two deployment descriptions are inconsistent: Kubernetes manifests use `latest`, while CI/CD uses remote Docker Compose over SSH. The runbook keeps those modes separate and does not imply either target exists or is healthy.

## Modified files

- Added this report and rollback/rehearsal instructions.
- No application, schema, migration, deployment workflow, secret, staging or production setting changed.

## Migration notes

No migration was executed or added. For any candidate deployment, review its SQL and generated Prisma migration before applying it to a disposable clone. Use additive expand-contract steps:

1. Add nullable columns/tables/indexes or dual-compatible structures; avoid rename/drop/type narrowing in the first release.
2. Deploy code that can read old and new representations; backfill in bounded, idempotent batches with counts/checkpoints and tenant filters.
3. Verify parity and old/new app compatibility, then switch reads/writes behind a server-side rollout flag.
4. Remove old representations only in a later release after rollback window expires and backup restore has been exercised.

Prisma migrate deploy has no general automatic down migration. If a migration is destructive or cannot coexist with the previous application, block rollout until a reviewed recovery plan and a tested disposable restore exist. Never use `prisma db push --accept-data-loss` for a deployment rollback.

## API and UI contracts

No API, event, schema or UI contract changed. Feature flags currently expose a frontend context (`flags`, `isEnabled`, `setFlag`, `loadFlags`) and localStorage key `feature-flags`; no authenticated server-side configuration contract is established by this implementation. Do not interpret a browser flag as authorization or assume it controls workers. Existing smoke flows and their API contracts remain unchanged.

## Rollback procedure (prepared, not executed)

Record the staging namespace/Compose project, release commit, image digests, migration IDs, database backup ID, operator, UTC start/end and command outputs in the deployment record. Confirm environment identity and that all targets are staging before any command. Do not paste secret values in the record.

### Kubernetes mode

Use only after an authorized staging rehearsal and after replacing placeholders with verified staging values. Capture the current and previous ReplicaSet revisions first. Pin the previous **digest** independently for each deployment; `kubectl rollout undo` is acceptable only when the ReplicaSet history is known to contain the intended digest.

```powershell
kubectl -n <staging-namespace> get deploy realtime-pulse-backend realtime-pulse-frontend realtime-pulse-worker -o wide
kubectl -n <staging-namespace> rollout history deploy/realtime-pulse-backend
kubectl -n <staging-namespace> set image deploy/realtime-pulse-backend backend=realtime-pulse/backend@sha256:<previous-backend-digest>
kubectl -n <staging-namespace> set image deploy/realtime-pulse-worker worker=realtime-pulse/backend@sha256:<previous-worker-digest>
kubectl -n <staging-namespace> set image deploy/realtime-pulse-frontend frontend=realtime-pulse/frontend@sha256:<previous-frontend-digest>
kubectl -n <staging-namespace> rollout status deploy/realtime-pulse-backend --timeout=180s
kubectl -n <staging-namespace> rollout status deploy/realtime-pulse-worker --timeout=180s
kubectl -n <staging-namespace> rollout status deploy/realtime-pulse-frontend --timeout=180s
```

If the old app fails readiness against the new schema, stop; do not repeatedly roll pods or reverse SQL. Apply the reviewed forward-compatible repair or restore a verified backup to a **new** isolated target. Production cutover requires its own approval and tested recovery plan.

### Compose/SSH mode

The existing workflow runs `docker-compose pull/up` and migrations remotely. Before a future staging rollout, ensure Compose uses immutable tags/digests for API and worker, record the old Compose revision and digests, and retain the previous image. Roll back by checking out the recorded Compose revision, pinning all services to recorded prior digests, and running `docker-compose up -d --no-deps api worker frontend` (service names must first be verified against the actual staging Compose file). Then check container health and smoke flows. Do not use the current production workflow's `down`/`up` step as a rollback: it does not select a known previous image and may cause unnecessary downtime.

### Feature flag and schema

Disable only a server-side rollout flag whose semantics and tenant scope have been reviewed; the current localStorage flags are not suitable. A flag cannot undo already persisted writes. Prefer a forward fix for schema problems. Data recovery requires the Phase 27 gate: managed encrypted backup, known restore point and a successful new-target restore drill; never restore in place as a routine rollback.

## Manual staging smoke and drill

This is an operator checklist, not a completed drill. Use an authorized disposable staging environment and fictional fixture tenants only. First ensure the CI job is not targeting production; never push to `main`/`develop` merely to trigger the current deployment workflow. Use a clean reviewed commit and environment-injected secrets. Verify target URLs/namespace and image digests before applying changes.

1. Capture release SHA, prior API/frontend/worker digests, deployment revisions, migration status, readiness, queue depth and current smoke baseline with UTC timestamps.
2. Deploy the immutable candidate API/frontend/worker images to staging. Apply only reviewed expand migrations. Verify `/api/v1/health/live` and `/api/v1/health/ready`, worker readiness/queue processing, and confirm no dev ports/credentials are exposed by the production-facing manifest.
3. Run `npm run test:smoke` in `e2e` against the configured isolated stack. Confirm agency and client persona flows, rejection of cross-tenant reads, expected visible error/retry states, and no credential in browser storage/artifacts.
4. In staging only, inject a controlled failing release or flag state, perform the image rollback above, and capture actual output/timestamps. Verify the critical smoke journey, queue idempotency and old/new schema compatibility afterward.
5. Verify the rollback's exact image digests and database migration state; do not claim schema rollback unless one was explicitly tested and safe. Attach redacted reports and close only after the incident/release owner signs off.

## Test commands and actual output

Test discovery was run locally without starting application servers:

```text
cd e2e
npm run test:smoke -- --list
```

**Exit code: 0.** Playwright discovered 10 tests in 2 files, including the agency/client cross-tenant rejection, invalid-share recoverable error, and command-center/report/analytics flows. This confirms discovery only; it is not a smoke E2E pass.

Docker daemon capability check:

```text
docker info --format '{{.ServerVersion}}'
permission denied while trying to connect to the Docker API at npipe:////./pipe/dockerDesktopLinuxEngine
Exit code: 1
```

The CLI exists, but the local Docker engine is unavailable to this session, so disposable DB/browser services could not be started. No live staging/production deployment, migration, or rollback drill was attempted. `git diff --check` exited 0; it emitted line-ending normalization warnings for pre-existing workspace edits. The worktree contains changes from earlier phases and is not a clean commit, so the clean-commit staging acceptance criterion is also unverified.

## Security, tenant review and data privacy

The smoke configuration uses loopback services, fictional `pulse_test` credentials and a test-only HMAC key; these are confined to test configuration (`e2e/playwright.smoke.config.ts:27-54`, `backend-nest/docker-compose.test.yml:3-24`). Local development Compose also contains a local-only password and binds Postgres/Redis to `127.0.0.1` (`backend-nest/docker-compose.yml:3-30`). These must not be copied to production. Kubernetes DB/Redis/JWT fields are Secret references, but the manifest itself does not prove production secret injection or RBAC.

Production safety gap: mutable image tags and unverified deployment workflow can make the running version ambiguous. Workflow SSH host/key fields are GitHub Secret references, but the action was not run and external action supply-chain configuration was not validated. Keep E2E reports redacted and short-lived; do not put credentials or customer records into screenshots/traces. The tenant denial flow is present in smoke source; actual browser execution is unverified because Docker is unavailable.

## Backup recovery

Follow [Phase 27 backup/restore instructions](../operations/backup-and-restore.md). That report records an unsafe global app restore surface and no verified database backup/PITR or restore exercise. Therefore database recovery is **not an available verified rollback path** today. Do not invoke application backup endpoints or perform a production/in-place restore. A safe next drill must restore an approved managed backup to a new disposable target, validate fictional tenant fixtures and checksums, record actual recovery timestamps, and delete only that target.

## Rollback of this phase

This phase is documentation-only. Reverting this added report removes the change; there are no application, flag, schema, data or infrastructure changes to undo.

## Unverified assumptions and result

- Kubernetes namespace, cluster access, current ReplicaSet history, actual image registry/digests, Compose service names and staging URL are unknown.
- CI/CD workflow secrets, approvals, SSH targets and external action policies were not inspected or exercised.
- Docker engine is unavailable, DB credentials/provider are not provisioned for this session, and the repository worktree is not clean.
- Migration compatibility and rollback characteristics vary by migration; no candidate migration was applied or rehearsed.
- Staging smoke and deployment rollback drill have no timestamped outputs because neither was run.

**BLOCKED — acceptance not met.** Before the next phase: create a clean reviewed commit; replace mutable tags with immutable digests and align ports/probes; establish an authorized staging-only path with environment-injected secrets and explicit approval gates; implement the smoke E2E CI job against disposable services; review a backward-compatible migration; then execute and record the staging deploy, smoke E2E and API/frontend/worker rollback drill. Do not enable production deployment or claim schema recovery until the Phase 27 backup/restore gate has passed.
