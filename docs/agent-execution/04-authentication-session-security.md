# Phase 04 — Authentication and session security

**Status: BLOCKED (core cookie-session path implemented and smoke-tested; full acceptance is not yet demonstrated).** The browser auth flow now uses HttpOnly cookies and passed local two-tab/replay/logout-all smoke coverage. Build, targeted tests, typecheck, database integration, and frontend build have passed. Full backend lint remains failing on repository-wide issues; older auth suites still cannot load transitive ESM dependencies (`jose` and `@nestjs/bull`) through the current CommonJS Jest harness. Live OAuth/provider and deployment log-sink behavior remain unverified.

## Existing state and evidence

- `backend-nest/src/auth/auth.controller.ts:57-91` configures HttpOnly session cookies, clears cookies, and rejects untrusted Origin/CSRF headers. `:144-207` implements cookie signup/signin/refresh/logout routes. `:348-358` retains cookie refresh/logout handling on legacy routes.
- `backend-nest/src/auth/auth.controller.ts:388-390` makes token-bearing legacy responses an explicit migration flag. `backend-nest/.env.example` defaults `AUTH_LEGACY_TOKEN_RESPONSES=false`; setting it true restores credential-bearing responses and is unsafe as a steady-state setting.
- `backend-nest/src/auth/guards/jwt-auth.guard.ts:12-25` checks Origin and `X-CSRF-Token` on unsafe cookie-authenticated requests. `backend-nest/src/auth/session-security.util.ts:3-13` requires an allowlisted origin and the fixed CSRF sentinel.
- `backend-nest/src/auth/guards/google-auth.guard.ts` and `github-auth.guard.ts` use the shared state verifier; `backend-nest/src/auth/guards/oauth-state.util.ts` performs constant-time comparison. State is atomically consumed through Redis cache operations.
- `backend-nest/src/auth/auth.service.ts` rotates refresh credentials by atomically consuming their Redis key and tracks per-user refresh/access token memberships for logout-all revocation. `backend-nest/src/auth/strategies/jwt.strategy.ts` validates blacklist state.
- `frontend/src/lib/api.ts:30-74` uses cookie credentials and serializes refresh with Web Locks where available. `frontend/src/store/auth.ts:17-22` removes old token storage keys; browser state contains user data only.
- `e2e/playwright.smoke.config.ts:25-26` disables Playwright traces for auth requests. `e2e/tests/smoke.spec.ts:5-8, 26-36` redacts credential-shaped values from diagnostics; `:57-72` checks token-free response/storage and cookie flags; `:76-98` checks concurrent tabs and refresh replay; `:154-178` checks duplicate creation, cross-tenant denial, and logout-all stale-session behavior.
- `backend-nest/src/common/middleware/http-logger.middleware.ts` and `logger.middleware.ts` log request paths without query strings. This only covers these app loggers; edge proxy, APM, browser network capture, and crash reporting settings were not inspected.

## Design / ADR

Keep the established auth route names and move browser auth to cookie-backed sessions by default. Use HttpOnly `pulse_access` and `pulse_refresh` cookies, rotate refresh credentials once, consume OAuth state once in Redis, and require trusted Origin plus a CSRF header for cookie-authenticated mutations. Keep `AUTH_LEGACY_TOKEN_RESPONSES` as a temporary compatibility switch only; do not enable it in normal environments. E2E disables traces to avoid preserving Cookie headers.

This changes no application database schema. Redis keys/sets hold short-lived OAuth state and session revocation membership. Existing legacy clients need to migrate before removing the compatibility switch.

## Modified files

Authentication/backend: `backend-nest/src/auth/auth.controller.ts`, `auth.service.ts`, `dto/auth.dto.ts`, `cookie-token.util.ts`, `session-security.util.ts`, `session-security.util.spec.ts`, `auth.controller.session.spec.ts`, `auth.service.session.spec.ts`, `guards/oauth-state.util.ts`, Google/GitHub/JWT guards, JWT strategy, `backend-nest/src/cache/cache.service.ts`, `redis.service.ts`, logger middleware, and auth `.env.example`.

Frontend: `frontend/src/contexts/auth-context.tsx`, `frontend/src/contexts/socket-context.tsx`, `frontend/src/hooks/useNotifications.ts`, `frontend/src/lib/api.ts`, `api-client.ts`, `auth.ts`, `frontend/src/store/auth.ts`, `frontend/src/types/index.ts`, auth login/signup/callback pages, and dashboard callers.

E2E and reproducibility: `e2e/playwright.smoke.config.ts`, `e2e/tests/smoke.spec.ts`, and lockfiles in backend, frontend, and E2E folders. Other changed files in the working tree belong to earlier phases and are not attributed to phase 04 here.

## API and UI contracts

- `POST /api/v1/auth/session/signup` and `/session/signin`: trusted Origin and `X-CSRF-Token: browser-session`; set HttpOnly access/refresh cookies and return user/expiry only.
- `POST /api/v1/auth/session/refresh`: same request checks; refresh credential is read from cookie; old refresh credential is consumed and a replacement is set.
- `POST /api/v1/auth/session/logout` and logout-all: trusted Origin/CSRF check; revoke server session state and clear browser cookies.
- `GET /api/v1/auth/me`: cookie session supported, with bearer compatibility for existing API callers. Unsafe cookie-auth requests require CSRF validation.
- OAuth callbacks set session cookies and redirect with provider metadata only; no access/refresh token is placed in the URL.
- UI stores user identity only. It sends cookies with API requests and refreshes once across tabs where Web Locks are supported.
- Contract change: default signup/signin/Firebase responses no longer expose access/refresh token fields; refresh consumes the cookie rather than a JSON token. `AUTH_LEGACY_TOKEN_RESPONSES=true` is a temporary compatibility rollback and reintroduces token exposure.

## Checks and actual results

Environment: Node `v26.13.1`, npm `11.20.0`.

| Check | Exit | Result |
|---|---:|---|
| `npm ci --no-audit --no-fund` in backend, frontend, E2E | 0 each | Clean lock installs passed (backend 1,462 packages/5m; frontend 628/4m; E2E 6/2m); registry required approved elevated access. |
| Backend Prisma generate and validate | 0 | Prisma Client generated; schema validated. |
| `cd backend-nest; npm run build` | 0 | Nest production build completed. |
| `cd backend-nest; npm run typecheck` | 0 | TypeScript check completed after updating two stale signup test fixtures. |
| `cd backend-nest; npm run test:ci -- --runTestsByPath src/auth/session-security.util.spec.ts src/auth/auth.service.session.spec.ts src/auth/auth.controller.session.spec.ts src/cqrs/event-sourcing.service.spec.ts src/cqrs/event-store.spec.ts --runInBand` | 0 | 5 suites, 15 tests passed, including forged/replayed OAuth state and event envelope contracts. |
| Earlier broader auth test command including `auth.service.spec.ts` and `auth.controller.spec.ts` | 1 | After aligning Nest 11 packages, these suites still fail to load transitive ESM (`jose` through Firebase/JWKS and `@nestjs/bull`) under the current CommonJS Jest transform; focused session suites pass. |
| Fresh disposable Postgres migration + fixture seed + `npm run test:integration` | 0 | Migration history and test DB integration passed; only disposable local test DB was used. |
| `cd e2e; npm run test:smoke` (latest clean install) | 0 | 2/2 tests passed; disposable DB integration passed 1/1; auto-teardown left no containers. Checks include response/storage/URL/referrer/history token absence, two-tab refresh, replay 401, duplicate create, cross-tenant 403, logout-all, and invalid-share recovery. Redis emitted transient connection-refused logs during app lifecycle. |
| `cd frontend; npm run typecheck` | 0 | TypeScript check passed. |
| `cd frontend; npm run build -- --webpack` (elevated local filesystem access) | 0 | Production build passed (61 pages); sandboxed run compiled then hit Windows `.next` prerender `EPERM`; default Turbopack earlier had a worker panic. |
| Backend full `npm run lint` | 1 | 799 problems over 416 files: 604 errors and 195 warnings. Targeted changed OAuth-state files lint exit 0. |
| Frontend full `npm run lint` | 1 | 886 problems: 67 errors and 819 warnings. |
| `git diff --check` | 0 | No whitespace errors; only Git line-ending notices. |
| Docker Compose validation | 0 | Local test compose configuration validated. Test DB data is disposable. |

The local smoke asserts current URL, referrer, history state, and browser storage for credential-shaped token values. It does not prove provider callback URL handling in a real OAuth redirect, ingress/APM secrecy, or production cookie topology.

## Manual smoke steps

1. Install each checked-in lockfile (`npm ci` in `backend-nest`, `frontend`, and `e2e`), then run `cd e2e; npm run test:smoke`. Playwright starts the isolated loopback/no-volume DB and Redis, waits for readiness, applies test migrations/fixtures, runs DB integration, and tears the project down. No live provider is needed.
2. Sign in and inspect the response, localStorage/sessionStorage, URL, browser history, and referrer. Confirm no bearer/refresh credential appears; cookies should be HttpOnly, SameSite=Lax, Secure under HTTPS, and refresh path scoped to `/api/v1/auth`.
3. Send unsafe session requests with missing Origin, forged Origin, missing CSRF header, and invalid CSRF header; each must fail without creating a session.
4. Reuse a consumed refresh credential and a forged/replayed OAuth state; both must fail. OAuth callback URLs should carry provider metadata only.
5. Run two tabs through refresh and logout-all. Confirm refresh rotation keeps both tabs current, then logout-all makes stale `/me` and refresh fail and returns both tabs to sign-in.
6. Review smoke diagnostics and any failure screenshot before sharing. Traces remain disabled because they can capture cookie headers.

## Security, tenant, and privacy review

- Local smoke confirms cross-tenant portal ID access returns 403 and duplicate create is idempotent. Existing tenant boundary behavior was not otherwise redesigned in this phase.
- Tokens are HttpOnly cookies for browser auth; frontend code does not read them. Server and E2E diagnostics omit or redact credentials. E2E traces are off. This does not validate all third-party logging/observability sinks.
- Fictional demo identities and a local disposable database were used. No live OAuth provider credentials were required or used. Live Google/GitHub callback verification remains untested.
- Existing user/session data was not migrated or deleted. Fresh migration testing used only the disposable local database. No production settings were touched.

## Migration, rollback, and recovery

1. Keep `AUTH_LEGACY_TOKEN_RESPONSES=false` as the secure default and deploy cookie-aware clients with backend support before retiring token-body clients.
2. Inventory external API consumers and confirm they support cookie sessions. Do not enable the compatibility flag in production as a routine rollback: it restores token exposure. If an emergency requires the old contract, gate access, time-box it, and disable it immediately after client recovery.
3. Roll back code by restoring the prior release and clearing the new cookies through logout/browser cleanup. There is no SQL backfill or schema rollback.
4. Redis unavailability blocks session rotation/state checks; recover Redis service and require re-authentication if session state was lost. Do not manually copy session tokens into logs or artifacts.

## Unverified assumptions and required next phase

- No live Google/GitHub provider account was used. Provider configuration, real redirect/cookie behavior, and provider revocation semantics remain unverified.
- Ingress, CDN, APM, browser recording, crash reporting, referrer policy, and proxy logs need an operational privacy audit before production use.
- Same-site frontend/API topology is assumed. Cross-site deployment requires explicit SameSite/CSRF and CORS review.
- Full backend lint still fails repository-wide, and the older auth test suites still fail at ESM module loading. These are reproducible code/tooling blockers, not missing provider access.

**Before Phase 05:** resolve the legacy Jest loader and lint baseline; reconcile supported Node versions across local development, existing CI, and the backend container (without rolling out a runtime change until approved); verify ingress/APM/referrer settings; and test real provider callbacks in an authorized staging environment. Until those gates pass, phase 04 remains **BLOCKED**.

## Verification refresh — 2026-11-24

The initial ESM failure was reduced by aligning `@nestjs/config`, `@nestjs/jwt`, `@nestjs/axios`, and `@nestjs/passport` with Nest 11-compatible majors and adding the missing `common/*` Jest alias (`backend-nest/package.json`, `package-lock.json`, `jest.config.js`). The repo pins the locally tested Node 26.13.1 in `.nvmrc` and has a Node 26 local-smoke CI workflow. The existing CI workflow still uses Node 20 and backend Dockerfile uses Node 18; no production runtime setting was changed, and support compatibility is unverified. Backend build/typecheck and the focused auth/event suite pass (5 suites/15 tests). The broader legacy auth suites still fail while importing provider/queue transitive ESM packages (`jose` via Firebase/JWKS and `@nestjs/bull`); they are not reported as passing. A separate unsafe architecture change to replace the app's queue integration was not attempted.

The latest lockfile-aligned Playwright smoke passed 2/2 tests; the setup now owns container start, Redis host-port readiness, DB migration/seed/integration, API startup, and global teardown. It asserts browser URL/referrer/history/storage credential absence. `git diff --check` passed. Full backend lint reports 604 errors and 195 warnings across 416 files; frontend lint reports 67 errors and 819 warnings. The focused auth/event suite passes 5 suites/15 tests. Generated smoke artifacts are local and gitignored.

Unit tests verify OAuth state comparison and CSRF predicate; the browser smoke verifies refresh replay but does not execute a real Google/GitHub redirect/callback. Provider accounts are intentionally not required for local tests. Proxy/CDN/APM/referrer and hosted CI behavior remain unverified. Do not enable `AUTH_LEGACY_TOKEN_RESPONSES=true`; it reintroduces token exposure.

**Phase status: BLOCKED.** Before Phase 05, resolve the legacy Jest loader and repository lint baseline, reconcile local, CI, and backend-container Node versions, add an authorized staging OAuth callback test, and inspect all deployed logging/referrer/network-trace sinks. No production action was taken.





