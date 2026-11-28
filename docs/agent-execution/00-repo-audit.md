# 00 — Repository audit

**Audit scope:** checkout `J:\SaaS\Projects\Real-Time-Pulse`, branch `master`; evidence checked 2026-11-23. This is a local source audit plus harness work only. No production, provider, or remote service was contacted. No schema or product behavior was changed.

## Current implementation summary

The repository contains a Next.js 16/React 19 UI (`frontend/package.json:5-9,51-52`), a NestJS 11/Prisma 7 API (`backend-nest/package.json:57-58,138`), PostgreSQL persistence (`backend-nest/prisma/schema.prisma:8-10`), Redis-backed Bull queues (`backend-nest/src/jobs/jobs.module.ts:14-32`), and Socket.IO realtime (`backend-nest/src/realtime/realtime.gateway.ts:46-47`). The server applies URI versioning and the `/api` prefix (`backend-nest/src/main.ts:116-123`). Auth controllers expose password and OAuth routes (`backend-nest/src/auth/auth.controller.ts:45-65,85-120`); workspace routes use JWT auth (`backend-nest/src/workspaces/workspace.controller.ts:32-50`). The actual dashboard is `frontend/src/app/dashboard/page.tsx:53-75`; the public sign-in route is `frontend/src/app/auth/login/page.tsx:109-112`.

The original run configuration had no checked-in environment example, an implicit backend container, globally published local database ports, inconsistent Prisma config variants, and E2E setup that attempted an unavailable login and silently substituted a fake token. The checked-in legacy seed also contains a plaintext password placeholder and a demo access token (`backend-nest/prisma/seed.ts:23-29,55-61`). The repository has no dependency lockfiles and none of the three package directories had installed dependencies when checked.

## Scoped plan and work performed

1. Inventory existing backend, UI, schema, auth, realtime, job, seed, and E2E implementations before adding infrastructure.
2. Keep the audit read-only with respect to product/schema; add local-only contributor/test infrastructure and documentation only.
3. Isolate disposable DB writes behind an explicit loopback `pulse_test` URL guard; use fictional `.invalid` accounts.
4. Validate Compose and script/package syntax. Run builds/smoke checks only where dependencies are installed; preserve actual exit codes.

Plan status: steps 1-4 performed to the extent allowed by the checkout. Build, test DB, health, and browser verification are **BLOCKED** by absent dependencies/services. See [Phase 01 report](./01-clean-room-boot.md).

## Highest-priority findings (20)

Statuses: **FIXED LOCALLY** means this phase added a guarded local path; **OPEN** means source evidence still shows a risk or mismatch; **BLOCKED** means verification requires missing dependencies or a disposable running DB. No item is a claim of production verification.

| # | Priority | Finding and evidence | Status |
|---|---|---|---|
| 1 | P1 | Root README calls the application “100% Production-Ready” and says all features are verified (`README.md:5-16`), while the backend README lists workspace/portal/widget and queue work as planned (`backend-nest/README.md:172-183`). Those statements conflict. | OPEN |
| 2 | P1 | README describes Prisma 6.18 (`README.md:405-412`); backend manifest declares Prisma CLI 7.3 and client/adapter 7.2 (`backend-nest/package.json:57-58,138`). Contributor steps must follow Prisma 7 config behavior. | OPEN |
| 3 | P1 | Package manifests do not declare `engines`, and no npm/yarn/pnpm lockfile is checked in (manifest identity at `backend-nest/package.json:1-5`; no lockfile found in repository file inventory). Exact supported Node/npm range and dependency graph are unverified. | OPEN |
| 4 | P1 | API config reads core values from environment (`backend-nest/src/config/app.config.ts:3-8`, `backend-nest/src/config/jwt.config.ts:3-5`); no env validation existed. Added fail-fast checks in `backend-nest/src/config/validate-env.ts:1-48` and connected them at `backend-nest/src/app.module.ts:82-85`. | FIXED LOCALLY; runtime unverified |
| 5 | P1 | Prisma schema uses Prisma 7 config style without a datasource URL (`backend-nest/prisma/schema.prisma:8-10`), and original `prisma.config.ts` read `DATABASE_URL` without loading dotenv or using Prisma 7's `datasource.url`. Added dotenv loading, `datasource.url`, and actionable missing-URL failure in `backend-nest/prisma.config.ts:1-17`, consistent with [Prisma 7 config reference](https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference). | FIXED LOCALLY; Prisma CLI unavailable |
| 6 | P1 | Three Prisma config variants existed; `prisma.config.js` and `.cjs` contain different URL compatibility workarounds (`backend-nest/prisma.config.js:1-18`, `backend-nest/prisma.config.cjs:1`). CLI config selection is unclear without the installed Prisma version. | OPEN |
| 7 | P1 | Original Compose file included an API service and exposed Postgres/Redis on all interfaces with fixed development credentials (`backend-nest/docker-compose.yml` before this phase, lines 3-57). Replaced with opt-in infrastructure profile and loopback-only ports (`backend-nest/docker-compose.yml:1-41`). | FIXED LOCALLY; config passes |
| 8 | P1 | Production requires JWT and encryption material; encryption service throws when missing (`backend-nest/src/common/services/encryption.service.ts:25-29`). Added validation for missing/short values and rejecting documented placeholders in production (`backend-nest/src/config/validate-env.ts:7-40`). | FIXED LOCALLY; runtime unverified |
| 9 | P1 | Legacy seed stores literal `hashed_password_here` as a password and `demo-token` as an integration access token (`backend-nest/prisma/seed.ts:23-29,55-61`). Do not use this seed for authentication or provider-connected development. | OPEN; legacy seed untouched |
| 10 | P1 | Legacy seed uses several `.create()` operations (`backend-nest/prisma/seed.ts:55,67,100,146`) and invokes advanced seed (`:324`), so repeat runs can duplicate or conflict. | OPEN; use guarded test fixture only |
| 11 | P1 | New fixture runner requires `TEST_DATABASE_URL` and only accepts loopback database `pulse_test` (`backend-nest/scripts/test-db-runner.cjs:7-24`); fixture data uses two fictional tenants and three `.invalid` accounts (`backend-nest/prisma/seed-test-fixtures.ts:20-71`). | FIXED LOCALLY; DB not run |
| 12 | P1 | Schema has ten migration directories (`backend-nest/prisma/migrations/` inventory), but none was applied or validated against a fresh database in this environment. | BLOCKED |
| 13 | P1 | Original E2E config used frontend port 3000 and backend port 3001 with `/health` (`e2e/playwright.config.ts:40,150-160`), opposite backend defaults (`backend-nest/src/config/app.config.ts:4`) and absent version/prefix (`backend-nest/src/main.ts:116-123`). | OPEN; isolated smoke config added |
| 14 | P1 | Legacy E2E global setup targets `/login`, uses default credentials, then silently writes `mock-token-for-testing` after failure (`e2e/global-setup.ts:41-49,55-78`). | OPEN; smoke avoids global setup |
| 15 | P1 | Added smoke test targets the actual public route and checks its rendered heading/button without credentials (`e2e/playwright.smoke.config.ts:4-22`, `e2e/tests/smoke.spec.ts:1-7`). | BLOCKED; Playwright unavailable |
| 16 | P1 | Health controller exposes live and ready checks (`backend-nest/src/health/health.controller.ts:13,46-62`); URI prefix/version imply `/api/v1/health/live` and `/api/v1/health/ready` (`backend-nest/src/main.ts:116-123`). Endpoint could not be called because API is not running. | BLOCKED |
| 17 | P1 | Workspace HTTP controller has JWT guard at controller level (`backend-nest/src/workspaces/workspace.controller.ts:32-50`); service verifies membership and owner/admin permissions (`backend-nest/src/workspaces/workspace.service.ts:37-47,61-61,383-411`). No cross-tenant HTTP integration test was run. | OPEN; fixture isolation test added, API test absent |
| 18 | P1 | Realtime gateway authenticates connection token and joins the token workspace room (`backend-nest/src/realtime/realtime.gateway.ts:110-137`); portal join queries with `{ id, workspaceId }` (`:183-200`). Other room subscription handlers need their own review before feature changes. | OPEN; partial boundary evidence only |
| 19 | P2 | Job service configures retry attempts/backoff (`backend-nest/src/jobs/jobs.service.ts:47-54,67-74,98-104`) and queue processors exist (`backend-nest/src/jobs/processors/`). No Redis-backed retry/duplicate execution was exercised. | BLOCKED |
| 20 | P2 | Frontend API helper defaults to `http://localhost:3001/api/v1` (`frontend/src/lib/api.ts:15-20`), while backend defaults to port 3000; socket context has another fallback (`frontend/src/contexts/socket-context.tsx:134-139`). Added frontend env example points API to 3000 (`frontend/.env.example:1-4`), but callers and full boot still need runtime validation. | OPEN |

## Secret and data handling

The checkout had no `.env` file or provider credential file in the file inventory. A targeted search for common secret assignment names returned only config/test source locations; values were not emitted. This is not a complete secret-scanning guarantee. No confirmed live key was copied into this report. If a real key is found in a later scan, redact it in logs and recommend owner-led rotation; no rotation was performed. Added env examples use explicit local-only placeholders. Test fixtures do not store passwords or provider tokens.

## Decision

Audit outcome: **BLOCKED for clean CI baseline**. Local configuration and safe fixture scaffolding are in place, but no lockfiles/dependencies are present, so actual schema validation, migrations, API health, builds, tests, and Playwright cannot pass in this checkout. No destructive migration, seed, container startup, external provider call, or production action was performed.

## Verification refresh — 2026-11-24

This dated update supersedes the dependency-unavailable status statements above. Package lockfiles were created for backend, frontend, and E2E; installed toolchains now run locally. Historical evidence and findings are retained as the initial audit snapshot. Current status of the 20 findings:

| # | Current status | Fresh evidence / remaining limit |
|---|---|---|
| 1 | PARTIAL | Root README now says production readiness is unverified and features are product scope; some detailed marketing/checklist copy remains and needs evidence review. |
| 2 | FIXED | Root README Tech Stack now lists Prisma 7; Prisma 7 validate passed using `backend-nest/prisma.config.js`. |
| 3 | PARTIAL | All three package locks are npm lockfile v3; `.nvmrc` pins the locally verified Node 26.13.1. Manifests do not declare supported engines. Existing CI uses Node 20 and backend Dockerfile uses Node 18, neither verified against the current dependency graph; the new local smoke workflow uses Node 26.x. |
| 4 | IMPLEMENTED | `backend-nest/src/config/validate-env.ts:1-48`; backend typecheck/build passed. Runtime negative config cases still need targeted test confirmation. |
| 5 | PASS LOCAL | `npm run prisma:validate` exit 0; Prisma 7 config loaded and schema valid. |
| 6 | OPEN | Prisma selected `prisma.config.js` during validation; alternate `.ts`/`.cjs` configs remain and need reconciliation. |
| 7 | PASS LOCAL | Development/test Compose config validated; disposable DB/Redis were loopback-only and removed after testing. |
| 8 | IMPLEMENTED | Production placeholder/missing-value checks remain source-backed in `validate-env.ts`; production startup not exercised. |
| 9 | OPEN | Legacy seed still contains placeholder password/token; do not use it. |
| 10 | PARTIAL | Guarded test fixture seed ran against fresh disposable DB. Legacy seed remains non-idempotent. |
| 11 | PASS LOCAL | `seed-test-fixtures.ts:20-71` ran with fictional `.invalid` users against `pulse_test`. |
| 12 | PASS LOCAL | All 12 discovered migration directories applied successfully on a fresh disposable Postgres database, including corrected index SQL and additive demo/event migrations. |
| 13 | PARTIAL | Dedicated Playwright smoke config uses the real `/auth/login` route and passed; original broad E2E config retains stale setup. |
| 14 | OPEN | Legacy `e2e/global-setup.ts` still contains fallback mock-token behavior; dedicated smoke does not load it. |
| 15 | PASS LOCAL | `cd e2e; npm run test:smoke` passed 2/2 tests; JSON report at `e2e/test-results/smoke-report.json` (generated output is gitignored). |
| 16 | PARTIAL | Smoke web server readiness called `/api/v1/health/live`; `/ready` was not separately asserted. |
| 17 | PARTIAL | Agency smoke proved another tenant's portal ID returns 403; complete workspace/realtime tenant matrix remains unaudited. |
| 18 | OPEN | Realtime room authorization needs a dedicated per-handler review and negative tests. |
| 19 | OPEN | Redis was used by auth/session smoke; Bull job retry/duplicate processing was not tested. |
| 20 | PASS LOCAL | Frontend production build and agency/client browser flow passed with explicit API URL; other socket fallback/deployment origins remain to review. |

Current code baseline is **BLOCKED for clean CI**: backend production build/typecheck, Prisma validation, disposable migrations/integration, and the dedicated smoke pass, but repository-wide backend lint returns exit 1 (604 errors, 195 warnings) and the legacy auth test suites still encounter CommonJS/ESM dependencies (`jose` and `@nestjs/bull`). Existing workflow/Docker Node versions (20/18) differ from the locally tested Node 26 and were not changed. No production or provider verification is claimed.


