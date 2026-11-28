# Phase 01 — Clean-room development and test harness

**Status: BLOCKED for a fully clean CI baseline.** Reproducible lockfiles, local configuration, disposable DB scaffolding, builds, Prisma validation/migrations, integration, health startup, and local smoke now run. The broad backend lint and legacy test suite remain failing; no hosted CI run or supported engine range has been established. No production data, settings, or external provider was touched.

## Existing state and evidence

- Backend is NestJS 11, TypeScript, Prisma 7, PostgreSQL and Redis; backend `package.json` declares Prisma client/adapter 7.2 and CLI 7.3 (`backend-nest/package.json:57-58,138`). Frontend is Next.js 16 / React 19 (`frontend/package.json:5-9,51-52`). E2E has Playwright scripts (`e2e/package.json:7-20`).
- The package manifests do not declare Node/npm engines; the repository has no tracked npm lockfile. This machine reports Node `v26.13.1`, npm `11.20.0`; those are observed host versions, not a supported-version declaration.
- Prisma 7 schema omits datasource URL (`backend-nest/prisma/schema.prisma:8-10`); `PrismaService` uses the PostgreSQL adapter (`backend-nest/src/prisma/prisma.service.ts:14-26`). `prisma.config.ts` now loads dotenv, sets Prisma 7 `datasource.url`, and fails clearly when `DATABASE_URL` is missing (`backend-nest/prisma.config.ts:1-17`), following the [official config reference](https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference). Alternate `.js` and `.cjs` configs remain and differ; Prisma’s selected config behavior was not executed.
- Original Compose included the API and bound databases to all interfaces. It is now opt-in local infrastructure only: Postgres/Redis health checks, persistent named development volumes, and `127.0.0.1` port bindings (`backend-nest/docker-compose.yml:1-44`). The test DB is a separate no-volume service on loopback port 55432 (`backend-nest/docker-compose.test.yml:1-17`). Compose files are development/test only; they do not configure production.
- Core env validation now checks `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, URL format, port bounds, and documented placeholders in production (`backend-nest/src/config/validate-env.ts:1-48`). `.env.example` values are intentionally fake and local-only (`backend-nest/.env.example:1-32`, `frontend/.env.example:1-4`).
- Legacy `prisma/seed.ts` remains unsuitable for auth or provider testing because it writes a placeholder password/token and uses non-idempotent create calls (`backend-nest/prisma/seed.ts:23-29,55-61,67-83`). New fixture seed is separate and guarded to loopback DB `pulse_test`; it creates Northstar and Juniper demo tenants, two owners, and a client account with `.invalid` emails (`backend-nest/prisma/seed-test-fixtures.ts:3-14,20-71`). It stores no password/provider token.
- Existing broad Playwright config/global setup has a stale path/port and a mock-token fallback (`e2e/playwright.config.ts:40,69-89,150-163`; `e2e/global-setup.ts:41-78`). A separate `test:smoke` config covers the actual public login route without auth/provider setup (`e2e/playwright.smoke.config.ts:4-22`; `e2e/tests/smoke.spec.ts:1-7`).

See [repository audit](./00-repo-audit.md) for the 20-item ranked findings, [current architecture](../architecture/current-system.md), and [feature evidence inventory](../product/feature-inventory.csv).

## Design / ADR

1. Keep the schema and production behavior unchanged. No migration or backfill is introduced.
2. Run the API on the host and start local data services only with an explicit Compose profile. Bind published data ports to loopback; persist development data in named volumes.
3. Give DB integration a separate container/database and guard every migration/seed command by exact loopback host and database name. Avoid `db push --accept-data-loss` in this workflow.
4. Use fictional `.invalid` identities and no login secret/provider credential for fixtures. Keep legacy seed untouched for auditability.
5. Separate a public UI smoke project from the broad legacy E2E suite. The smoke path does not require OAuth or an authenticated account.
6. Use existing feature modules/config rather than duplicate auth, Prisma, health, or DB modules.

## Modified files

- `README.md` — points new contributors to this single local setup guide.
- `.gitignore` — permits checked-in env example; backend/frontend ignore rules now permit package lockfiles.
- `backend-nest/.env.example`, `frontend/.env.example` — safe local-only templates; frontend ignore now permits the example.
- `backend-nest/.gitignore`, `frontend/.gitignore` — stop ignoring future package lockfiles; none could be generated here.
- `backend-nest/docker-compose.yml`, `backend-nest/docker-compose.test.yml` — opt-in persistent local infra and isolated disposable test DB.
- `backend-nest/prisma.config.ts`, `backend-nest/src/app.module.ts`, `backend-nest/src/config/validate-env.ts` — Prisma dotenv loading and early env validation.
- `backend-nest/prisma/seed-test-fixtures.ts`, `backend-nest/scripts/test-db-runner.cjs`, `backend-nest/scripts/prisma-runner.cjs` — guarded idempotent fixtures and local CLI runners that do not use `npx` to fetch missing tools.
- `backend-nest/src/config/validate-env.spec.ts`, `backend-nest/src/prisma/test-db.integration.spec.ts` — config failure tests and DB isolation integration contract.
- `backend-nest/package.json`, `frontend/package.json`, `e2e/package.json` — build/typecheck/test/db service scripts.
- `e2e/playwright.smoke.config.ts`, `e2e/tests/smoke.spec.ts` — credential-free public-route smoke test.
- `docs/agent-execution/00-repo-audit.md`, `docs/agent-execution/00-repository-forensics.md`, `docs/agent-execution/01-clean-room-boot.md`, `docs/architecture/current-system.md`, `docs/product/feature-inventory.csv` — audit and runbook deliverables.

## Migration and compatibility notes

No Prisma model or migration file changed, so there is no schema contract diff, backfill, rollout flag, or production rollback migration. Existing routes and response contracts are unchanged. New `TEST_DATABASE_URL` and local Compose resources are opt-in. `prisma:migrate:deploy` applies existing committed migrations; it was not run. The root README now references the new guide. The legacy seed and broad E2E suite remain as-is and are documented limitations.

## API and UI contracts

- API default port: 3000 (`backend-nest/src/config/app.config.ts:4`). Global prefix and URI version: `/api/v1` (`backend-nest/src/main.ts:116-123`). Health handlers are `GET /api/v1/health/live` (process liveness) and `GET /api/v1/health/ready` (Postgres + Redis readiness) (`backend-nest/src/health/health.controller.ts:46-62`). Runtime path/health response not verified.
- Sign-in route: `POST /api/v1/auth/signin`; body is the existing `SignInDto` and response is existing auth response (`backend-nest/src/auth/auth.controller.ts:64-80`). OAuth routes exist but are not used by the smoke path.
- UI smoke contract: `GET /auth/login` renders “Welcome Back” and a “Sign in” button (`frontend/src/app/auth/login/page.tsx:109,248-258`). API behavior and login loading/error behavior remain owned by the existing component.
- Fixture contract: tenant IDs are stable UUIDs; owner/client emails use reserved `.invalid`; all fixture users have `password=null`, are unverified and cannot be used to authenticate.

## Initial reproduction and check output (2026-11-23; superseded below)

Observed versions: `node --version` → `v26.13.1`; `npm --version` → `11.20.0`; `docker compose version` → `Docker Compose version v5.7.0`. npm lockfile v3 is checked in for all three packages. No project `engines` range exists; `.nvmrc` captures the tested local Node version but does not resolve Node 18 container/Node 20 CI compatibility.

| Command | Exit | Result |
|---|---:|---|
| `docker compose --profile local config` (from `backend-nest`) | 0 | PASS; only Postgres and Redis, both bound to `127.0.0.1`, health checks and persistent volumes rendered. |
| `docker compose -f docker-compose.test.yml config` (from `backend-nest`) | 0 | PASS; `pulse_test` only, loopback port 55432, no volume. |
| `node --check scripts/prisma-runner.cjs; node --check scripts/test-db-runner.cjs` (from `backend-nest`) | 0 | PASS; script syntax. |
| `node -e "JSON.parse(...package.json...)"` in backend, frontend, and e2e | 0 each | PASS; manifests parse. |
| `Import-Csv docs/product/feature-inventory.csv` structure check | 0 | PASS; 15 rows, 0 missing columns. |
| `TEST_DATABASE_URL=.../not_test node scripts/test-db-runner.cjs migrate` | 2 | PASS; refused before any CLI/database access because database was not `pulse_test`. |
| `node scripts/test-db-runner.cjs migrate` without `TEST_DATABASE_URL` | 2 | PASS; failed closed with actionable setup message. |
| `npm run build` (from `backend-nest`) | 1 | BLOCKED: `'nest' is not recognized as an internal or external command`; backend `node_modules` absent. |
| `npm run build` (from `frontend`) | 1 | BLOCKED: `'next' is not recognized as an internal or external command`; frontend `node_modules` absent. |
| `npm run lint` and `npm run test:ci` (from `backend-nest`) | 1 each | BLOCKED: `eslint` and `jest` are not recognized; backend `node_modules` absent. |
| `npm run typecheck` (from `frontend`) | 1 | BLOCKED: `tsc` is not recognized; frontend `node_modules` absent. |
| `npm run test:smoke` (from `e2e`) | 1 | BLOCKED: Playwright executable did not run the `test` command; E2E `node_modules` absent. |
| `npm run prisma:validate` (from `backend-nest`) | 1 | BLOCKED: `Prisma CLI is not installed. Restore the backend package lockfile and dependencies, then retry.` No database access was attempted. |
| `npm run test:integration` / `npm run prisma:migrate:deploy` | Not run | BLOCKED: no dependencies or test DB running. This avoids executing migrations against any existing/local user database. |
| API health smoke | Not run | BLOCKED: API and DB/Redis not running. |
| `git diff --check` | 0 | PASS; whitespace check clean. |

The original dependency failures were resolved by creating package lockfiles and installing dependencies. `.nvmrc` pins the verified local toolchain Node 26.13.1/npm 11.20.0; package manifests do not declare supported engines. A non-deploying CI smoke workflow uses Node 26.x, but the existing CI workflow uses Node 20 and the backend Dockerfile uses Node 18. That runtime compatibility gap is not resolved here because it affects production image settings. The refreshed outcomes and reproducible commands are recorded below. No OAuth account/key is required for local contract tests; live OAuth remains unverified by design.

## Local start and smoke steps

1. Install the checked-in locks from the repository root: `cd backend-nest; npm ci`; then `cd ../frontend; npm ci`; then `cd ../e2e; npm ci`. `.nvmrc` pins the tested local Node 26.13.1; use npm 11.20.0. Package engine ranges remain undeclared pending review of the Node 18 Docker runtime and Node 20 existing CI workflow.
2. Validate the Prisma schema from `backend-nest`: `npm run prisma:validate`.
3. From `e2e`, run `npm run test:smoke`. The API webServer command starts only loopback no-volume Postgres/Redis test containers, waits for health/Redis PING, migrates and seeds the disposable `pulse_test` DB with fictional two-tenant fixtures, runs DB integration, then starts the API; Playwright starts the frontend. Global teardown removes the test project. No `.env` editing, OAuth key, live provider, or manual account setup is needed for this smoke flow.
4. Review `e2e/test-results/smoke-report/index.html` and `e2e/test-results/smoke-report.json`. The smoke covers agency owner → demo client portal, persistence on reload, duplicate create, cross-tenant 403, refresh replay 401, and logout-all.
5. When finished, from `backend-nest` run `npm run test:db:down`. This removes the no-volume test containers/database only. Normal development services are separate (`npm run services:up` / `npm run services:down`) and persist named volumes; do not use `down -v` as routine cleanup.
6. For explicit manual API/UI startup, copy the local-only templates, start the local Compose profile, run the backend on port 3000 and frontend on port 3001. Do not run the legacy seed. The authenticated fictional demo flow is exercised by step 3 against the isolated test setup.

## Security, tenant, and privacy review

New Docker ports bind to localhost; no API container auto-starts; test DB has no persistent volume; DB mutation helper refuses non-loopback hosts or a database other than `pulse_test`. The fixture uses no real contact data, passwords, tokens, provider credentials, or external requests. Env validation errors name missing keys but never print their values. Workspace controller is JWT guarded; workspace service has membership and role checks; realtime portal join includes authenticated workspace scope. This is a source review of selected paths, not a complete tenant-isolation certification.

No real secret was confirmed in the targeted scan; known legacy token/password strings are dummy literals in the legacy seed and were not repeated beyond source location. If a later broader scan finds live credentials, redact the finding and recommend owner-coordinated rotation; none was rotated here.

## Rollback

All code/config changes are local and reversible through version control. No data migration or provider action was executed. Removing the test DB container with `npm run test:db:down` removes only the ephemeral test database. Development named volumes are preserved by `services:down`. Do not use `docker compose down -v` or the existing `prisma:dbpush` script for rollback.

## Unverified assumptions and blockers

- Local Node 26/npm 11 behavior is verified for the recorded checks. Compatibility of Node 18 container and Node 20 existing CI environments with the current dependency graph remains unverified; reconcile before rollout.
- Prisma selected `prisma.config.js` during validate/generate. Alternate `.ts` and `.cjs` configs remain and need reconciliation.
- Config validation tests passed 4/4; DB integration passed 1/1 in the disposable smoke setup.
- All 12 migrations were applied on fresh no-volume Postgres; Compose health and host Redis PING are checked by the smoke runner. The separate `/health/ready` endpoint is not explicitly asserted.
- Backend and frontend production builds passed locally; `/api/v1/health/live` is used as Playwright API readiness.
- Dedicated Chromium Playwright smoke passed 2/2. The legacy broad E2E setup still retains stale path/port/mock-token behavior and remains unverified.
- Test fixtures use fictional `.invalid` accounts and a local-only fixture password; no provider or real user credentials are used.
- A non-deploying smoke workflow was added and its YAML parsed locally; a hosted workflow run has not occurred.

## Decision and next phase gate

**BLOCKED — Phase 01 clean-CI acceptance is not met.** Clean installs, Prisma validate, fresh DB migrations/fixture/integration, backend/frontend builds/typechecks, config tests, and the dedicated browser smoke now pass locally. Before the next phase, resolve full backend/frontend lint and legacy Jest issues; reconcile Node 26 local test, Node 20 existing CI, and Node 18 backend image support without changing production settings without authorization; then execute the added hosted smoke workflow.

## Verification refresh — 2026-11-24

This update supersedes the initial “dependencies unavailable” test table where checks have since run. Reproducible package lockfiles now exist at `backend-nest/package-lock.json`, `frontend/package-lock.json`, and `e2e/package-lock.json`. The observed local toolchain is Node 26.13.1/npm 11.20.0; package manifests have no engine declaration because existing Node 18 container and Node 20 CI are unverified. Prisma 7 validation passed; the fresh disposable `pulse_test` database applied all 12 migrations, loaded the fictional two-tenant/client fixture, and passed the database integration check. Backend build/typecheck passed; frontend typecheck and webpack production build passed. The agency/client Playwright smoke passed 2/2 tests and waited for `/api/v1/health/live`. Compose config passed for both profiles. Backend lint exits 1 (604 errors/195 warnings) and frontend lint exits 1 (67 errors/819 warnings), so this is not a clean CI baseline. The broad legacy E2E setup remains separate and unverified.

### Current local reproduction

From `backend-nest`, run `npm ci`, `npm run prisma:validate`, and `npm run test:integration` with `TEST_DATABASE_URL=postgresql://pulse_test:pulse_test_only_password@127.0.0.1:55432/pulse_test?schema=public`. From `frontend`, run `npm ci`, `npm run typecheck`, and `npm run build -- --webpack`. From `e2e`, run `npm ci` then `npm run test:smoke`; the API webServer script prepares the disposable loopback database/services and global teardown removes them. Do not point these commands at any non-test database.

The backend-wide test command is not yet clean: the focused auth/session/event suite passed 5 suites/15 tests; config validation passed 1 suite/4 tests. The older general auth suites still fail to load provider/queue transitive ESM modules under the current CommonJS Jest harness. Full lint and Node support across local, CI, and container environments remain blockers. Do not start the next phase on the claim of a clean CI baseline until those are resolved.



## Latest clean-install verification — 2026-11-24

The lockfile-based setup has now been exercised from clean installs on the tested Windows host: backend `npm ci --no-audit --no-fund` exited 0 (1,462 packages, ~5m), frontend exited 0 (628 packages, ~4m), and E2E exited 0 (6 packages, ~2m). Host toolchain: Node 26.13.1/npm 11.20.0; lockfile format 3. The app's `.nvmrc` records the local Node version. No engines range is declared because the existing CI workflow still uses Node 20 and the backend Dockerfile uses Node 18; those runtime paths were not changed or verified.

After the clean installs: Prisma Client generate 0; backend build 0; backend typecheck 0; Prisma validate 0; focused auth/session plus event suite 5 suites/15 tests pass; frontend typecheck 0; frontend webpack build 0 when run with elevated local filesystem access (the sandboxed Windows worker returned `EPERM` while creating `.next` prerender directories). Fresh smoke setup applied all 12 migration directories, seeded the deterministic Northstar/Juniper/client fixtures, and passed DB integration (1 suite/1 test). Playwright agency/client smoke passed 2/2 tests; it checks token-free response/storage/URL/referrer/history state, cookies, two-tab refresh, refresh replay 401, duplicate create idempotency, other-tenant portal 403, logout-all stale-session rejection, and invalid-link error recovery. Test containers are removed by global teardown and were confirmed absent after the latest successful run.

The smoke startup is now one documented path: Playwright starts `backend-nest/scripts/start-smoke-api.cjs`, which recreates only the loopback/no-volume test Compose project, waits for health and Redis PING, migrates/seeds/tests the disposable database, and launches the API. Playwright has server reuse disabled and a teardown script removes only that Compose project. A transient initial Redis-readiness failure occurred before consolidating this lifecycle; the final consolidated smoke run passed. The successful run still logged transient Redis connection-refused messages during app lifecycle, which remain an item to inspect.

| Current check | Exit/status | Evidence |
|---|---:|---|
| Backend `npm run lint` | 1 | 604 errors, 195 warnings over 416 files. |
| Frontend `npm run lint` | 1 | 67 errors, 819 warnings. |
| Legacy general auth service/controller suites | 1 | Jest CommonJS harness still cannot load provider/queue transitive ESM (`jose`, `@nestjs/bull`); focused cookie/session tests pass. |
| `npm run test:smoke` (E2E, latest clean install) | 0 | 2 passed; disposable DB integration 1/1 passed; test compose removed. |
| `.github/workflows/local-smoke.yml` YAML parse | 0 | Non-deploying smoke workflow added; hosted GitHub Actions execution has not occurred. |
| `git diff --check` | 0 | Only Git LF/CRLF notices. |

**Status remains BLOCKED for acceptance.** The local setup and smoke are demonstrated, but full lint, old unit suite, existing CI/Docker runtime compatibility, and hosted CI execution remain unresolved. No live OAuth key is required for mocks/local tests; live provider verification is separately blocked on an authorized provider environment.
