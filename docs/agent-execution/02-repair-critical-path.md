# Phase 02 — Repair critical path

**Status: BLOCKED for hosted CI/full baseline.** The local demo connector, agency-to-client path, tenant checks, and traceable Playwright failure artifacts are implemented and the smoke passes locally. Full lint/legacy suites and hosted CI remain unresolved. No provider credentials, live accounts, production services, or production data were used.

## Existing state and evidence

- The existing portal and integration modules were extended; no duplicate feature module was added. The portal controller is `backend-nest/src/portals/portal.controller.ts:24-30,62-67`; service and module wiring are `backend-nest/src/portals/portal.service.ts:45-190` and `backend-nest/src/portals/portal.module.ts:1-13`.
- Before this phase, the smoke spec only loaded the login page, and the old global setup could use a fabricated token. The dedicated smoke config/spec are now `e2e/playwright.smoke.config.ts:1-58`, `backend-nest/scripts/start-smoke-api.cjs`, `e2e/global-teardown-smoke.ts`, and `e2e/tests/smoke.spec.ts`; the broad legacy E2E setup was not used.
- The local fixture seed now has two fictional tenants and an owner, member/client, and second-tenant owner with local-only password hashes (`backend-nest/prisma/seed-test-fixtures.ts:1-89`). The tenant-B portal is private and has a stable ID (`:91-106`).
- `backend-nest/AGENTS.md` and root `AGENTS.md` are absent. The repository's Phase 01 setup guide and architecture/inventory documents were read before extending this work.

## Design / ADR

1. Add `DEMO` to the existing integration provider enum, with an additive PostgreSQL enum migration. The existing integration and portal services remain the source of truth.
2. Use a deterministic, fictional connector with no provider requests or provider keys. Display a clear “Fictional demo data — not live provider metrics” label in the client view.
3. Create/reuse one portal, widget, and demo integration per workspace in one Prisma transaction. Only workspace OWNER/ADMIN can create it; workspace identity comes from the JWT user, never the request body.
4. Public share access returns an allowlisted view only. A public token resolves only a public portal; integration credentials/settings are not serialized by that endpoint.
5. The smoke setup recreates only the named no-volume `pulse_test` Postgres/Redis test containers, then generates Prisma, applies migrations, seeds, and runs the database fixture test. The setup refuses non-loopback or non-`pulse_test` database URLs.
6. The browser flow uses local owner and client fixture accounts and no OAuth/provider accounts. Failures attach step/HTTP/console/request diagnostics and screenshots; Playwright retains a failure trace and emits HTML/JSON reports.

## Modified files

- Backend: `backend-nest/prisma/schema.prisma`, `backend-nest/prisma/migrations/20261123150000_add_demo_integration_provider/migration.sql`, `backend-nest/src/integrations/integration.service.ts`, `backend-nest/src/integrations/integration.controller.ts`, `backend-nest/src/integrations/integration.module.ts`, new `backend-nest/src/integrations/services/demo-connector.service.ts`, new `backend-nest/src/integrations/services/demo-connector.service.spec.ts`, new `backend-nest/src/integrations/integration.service.security.spec.ts`, `backend-nest/src/portals/portal.controller.ts`, `backend-nest/src/portals/portal.module.ts`, `backend-nest/src/portals/portal.service.ts`, `backend-nest/src/portals/dto/portal.dto.ts`, new `backend-nest/src/portals/portal.service.spec.ts`, `backend-nest/prisma/seed-test-fixtures.ts`, `backend-nest/src/prisma/test-db.integration.spec.ts`, `backend-nest/docker-compose.test.yml`, and new `backend-nest/scripts/start-smoke-api.cjs`.
- Frontend: `frontend/src/app/dashboard/page.tsx`, `frontend/src/app/v/[shareToken]/page.tsx`, `frontend/src/lib/api-client.ts`, and `frontend/src/types/index.ts`.
- E2E: `e2e/playwright.smoke.config.ts`, `e2e/global-teardown-smoke.ts`, `e2e/tests/smoke.spec.ts`, `backend-nest/scripts/start-smoke-api.cjs`, the non-deploying CI smoke workflow, and package locks.
- Docs: this report, `docs/architecture/current-system.md`, and `docs/product/feature-inventory.csv`.

## Migration and compatibility notes

- Contract diff: a new `DEMO` value is added to `IntegrationProvider`; existing values and tables are unchanged. New routes are `POST /api/v1/portals/demo` (JWT; OWNER/ADMIN) and `GET /api/v1/portals/share/:shareToken/view` (public, public portal only). A new `/v/:shareToken` UI route consumes the public view. Demo metrics are explicitly synthetic.
- Migration: `ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'DEMO'`. This is additive and has no backfill. It was not applied because Prisma CLI/dependencies are unavailable. No production migration was run.
- Rollback: stop exposing/calling the demo routes and revert application code. Leave the unused enum value in place; dropping a PostgreSQL enum value is unsafe and unnecessary. No data deletion or production rollback was attempted. The demo rows, if created in a local test DB, are isolated to `pulse_test` and are reproducible by recreating its no-volume containers.
- The sign-in API response unwrap in `frontend/src/lib/api-client.ts:32-35` was corrected to match the existing response envelope so the real seeded login can complete. No route request/response fields for existing features were otherwise changed.

## API and UI contracts

- `POST /api/v1/portals/demo`: authenticated. The service checks the current user belongs to the workspace and has OWNER/ADMIN role, then transactionally upserts records with fixed tenant-scoped IDs/slug. Repeated calls return the same portal/share token. Evidence: `backend-nest/src/portals/portal.controller.ts:26-30`; `backend-nest/src/portals/portal.service.ts:56-143`.
- `GET /api/v1/portals/share/:shareToken/view`: no login required; returns portal name, workspace name/color, widget metadata, and fixed demo values only. Private/missing shares return 404. Evidence: `backend-nest/src/portals/portal.controller.ts:62-67`; `backend-nest/src/portals/portal.service.ts:146-190`.
- `POST /api/v1/v1/integrations/demo`: existing controller path includes the literal `v1/integrations` under the global `/api/v1` prefix; it is JWT-guarded and scopes to the current user workspace. It is not needed by the dashboard path.
- Dashboard: the “Create demo client portal” button has a pending state, success confirmation, and retry-safe error message (`frontend/src/app/dashboard/page.tsx:137-150,379-388`). The client view includes loading, empty, retryable error, and prominently labeled fictional sample states (`frontend/src/app/v/[shareToken]/page.tsx:22-45,64-91`).
- E2E: owner signs in, creates the portal, client fixture signs in in a clean browser context, opens the public link, reloads it, checks the fixed data, retries creation and verifies idempotency, and asserts another tenant's private portal ID returns 403 (`e2e/tests/smoke.spec.ts:9-124`). A stale/invalid share has its own error-state check.

## Test commands and actual output

All checks below were run on 2026-11-23. The checkout has no `package-lock.json` files and no `node_modules` in the backend, frontend, or E2E packages. An earlier offline lockfile attempt returned `ENOTCACHED` because required package metadata is not cached; no network installation was attempted.

| Command | Exit | Result |
|---|---:|---|
| `git diff --check` | 0 | Passed; Git emitted only working-tree LF/CRLF notices. |
| `docker compose -f docker-compose.test.yml config -q` (backend-nest) | 0 | Passed. |
| `docker compose -f docker-compose.yml config -q` (backend-nest) | 0 | Passed. |
| `node --check scripts/start-smoke-api.cjs` (backend-nest) | 0 | Passed. |
| `npm run build` (backend-nest) | 1 | Blocked: `'nest' is not recognized`. |
| `npm run lint` (backend-nest) | 1 | Blocked: `'eslint' is not recognized`. |
| `npm run build` (frontend) | 1 | Blocked: `'next' is not recognized`. |
| `npm run lint` (frontend) | 1 | Blocked: `'eslint' is not recognized`. |
| `npm run test:ci` (backend-nest) | 1 | Blocked: `'jest' is not recognized`. |
| `npm run prisma:validate` (backend-nest) | 1 | Blocked: Prisma CLI is not installed. |
| `TEST_DATABASE_URL=postgresql://pulse_test:pulse_test_only_password@127.0.0.1:55432/pulse_test?schema=public npm run test:integration` (backend-nest) | 1 | Guard accepted the disposable target; blocked because Prisma CLI is not installed. No container or DB was started/changed. |
| `npm run test:smoke` (e2e) | 1 | Blocked: installed `playwright` command reports `unknown command 'test'`; `@playwright/test` is not installed. |

No API health response, schema migration, seed, browser session, screenshot, or real E2E result exists yet. The Compose YAML syntax check is not a service health check. Build/lint status is recorded in this report; a separate non-deploying smoke workflow was added after lockfiles were generated.

## Manual smoke steps (after dependency restore)

1. Restore/commit dependency lockfiles for all three packages using the project's approved package registry/cache, then install dependencies and the Playwright Chromium browser. This must not require OAuth or provider keys.
2. From `e2e`, set `TEST_DATABASE_URL` to loopback `/pulse_test` (the default is port 55432), then run `npm run test:smoke`. Global setup recreates only the no-volume test Postgres/Redis containers, waits for health, generates Prisma, migrates, seeds fixtures, and executes the DB fixture check. Playwright starts API/frontend and waits on `/api/v1/health/live` and `/auth/login`.
3. Confirm the report in `e2e/test-results/smoke-report/index.html`, JSON at `e2e/test-results/smoke-report.json`, and traces/screenshots/diagnostics under `e2e/test-results/smoke-artifacts`.
4. If starting/stopping test services manually, from `backend-nest` use `npm run test:db:up` and later `npm run test:db:down`. These target only the test Compose project. Do not use the legacy production-like seed command for this workflow.

## Security and tenant review

- Portal creation derives workspace from the authenticated user and checks OWNER/ADMIN. Unit coverage denies a user whose actual workspace differs and denies a MEMBER before starting the transaction (`backend-nest/src/portals/portal.service.spec.ts:15-39`).
- Integration resource routes now check workspace ownership before reads, updates, deletes, sync, connection tests, and fetches (`backend-nest/src/integrations/integration.controller.ts:34-99`; `integration.service.ts` workspace access helper). New negative unit cases cover other-workspace and stale integration IDs (`backend-nest/src/integrations/integration.service.security.spec.ts:8-25`).
- The public endpoint only loads explicitly public portals and selects integration ID/provider, not access/refresh tokens or integration settings. The demo record uses `DEMO_ONLY_NO_CREDENTIAL` and never calls a provider.
- The smoke fixture deliberately includes a private Juniper portal. The test asserts a Northstar owner gets 403 when requesting its ID. The local smoke runtime test passed; hosted CI is not yet verified.
- No real secrets were inspected or printed. Fixture emails use `.invalid`; password `PulseDemo!2026` is a public local test credential only and must never be reused outside the disposable test DB.

## Data privacy

The demo connector is fixed fictional business data (Northstar Demo Studio sample), labeled in API/UI as synthetic. The public client page exposes only the data needed for the sample view. Browser diagnostics redact share tokens from captured URLs; successful response bodies are not logged. Screenshots/reports may contain rendered demo values and should remain local/CI test artifacts with ordinary retention controls.

## Unverified assumptions / residuals

- Nest/Prisma generated types, migration validity against a fresh PostgreSQL instance, seed compatibility, successful auth/Redis behavior, public response shape, visual rendering, and browser selectors are unverified until dependencies are restored and the workflow runs.
- Lockfiles and local Node/npm are now recorded, but supported deployment versions remain unresolved: host .nvmrc is Node 26 while existing CI is Node 20 and backend image uses Node 18.
- OAuth/provider live verification is intentionally not needed for this local connector and remains untested.
- The local owner-to-client smoke and backend/frontend production builds passed; a non-deploying GitHub Actions smoke workflow is configured but not hosted-run. Broad backend/frontend lint still fails, so the phase remains BLOCKED.

## Exactly what must happen before Phase 03

1. Reconcile full backend/frontend lint and legacy Jest failures; verify Node 26 local workflow against the intended CI/runtime matrix.
2. Run `.github/workflows/local-smoke.yml` on a hosted pull request; preserve its artifact and verify health/readiness under the CI runner.
3. Keep the smoke workflow independent of live OAuth providers and production deployment jobs; do not advance while full lint and compatibility failures are unexplained.

## Verification refresh — 2026-11-24

The earlier dependency-unavailable table is historical. After restoring package locks and installing dependencies, local validation produced: backend build 0; backend typecheck 0; Prisma validate 0; fresh disposable Postgres migrations/seed/integration 0; frontend typecheck 0; frontend webpack production build 0; and `cd e2e; npm run test:smoke` 0 with 2 passed/0 failed. The current smoke report is `e2e/test-results/smoke-report.json`; it records step labels, response statuses, console/request failures, and failure-only screenshots (Playwright traces remain off). It demonstrated agency-owner portal creation, client view reload, duplicate-create idempotency, cross-tenant private portal denial (403), refresh replay rejection (401), and logout-all stale-session rejection. A first rerun hit a transient Redis readiness failure; explicit Compose readiness then succeeded and the retry passed. The broad backend lint still fails (604 errors/195 warnings), and the smoke has not run in hosted CI. Therefore Phase 02 remains **BLOCKED for acceptance**; local core flow itself passed. No live provider or production service was used.

**Before Phase 03:** wire the dedicated smoke into a non-deploying CI job after reconciling the lint/Jest baseline and confirm it passes on the intended Node LTS version. Preserve the separate legacy E2E suite until its stale setup is migrated or it has a documented deprecation decision.

## Final local verification — 2026-11-24

The E2E smoke setup and failure dashboard are now wired to a non-deploying workflow at `.github/workflows/local-smoke.yml`. That workflow installs all three lockfiles under Node 26.x, installs Chromium, runs the real agency-owner → demo client flow without provider keys, and uploads the redacted JSON/HTML/failure artifacts for seven days. Workflow YAML parsed locally (exit 0); a hosted run is not available in this session.

All three clean `npm ci` installs passed. The final local `npm run test:smoke` passed 2/2 tests after the consolidated startup/teardown changes; the smoke starts only loopback disposable Postgres/Redis, applies all 12 migrations, seeds fictional two-tenant/client fixtures, and cleans the test containers after the run. The UI/auth test now checks browser storage, current URL, referrer, history state, response JSON, HttpOnly cookies, two tabs, replay, stale logout-all, duplicate portal create, tenant denial, and invalid-share error recovery. E2E trace stays off and failure diagnostics redact credentials.

Backend build/typecheck and focused auth/event tests pass. Full backend lint exits 1 (604 errors/195 warnings); frontend lint exits 1 (67 errors/819 warnings). Existing full E2E/auth suites are not CI-clean. Existing GitHub workflow uses Node 20; backend container targets Node 18; only local Node 26.13.1 was exercised. No production pipeline/runtime setting was changed. This phase remains **BLOCKED** until hosted CI completes this smoke and the broader lint/test/runtime matrix is reconciled.


