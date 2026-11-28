# Phase 06 — Sharing permissions

**Status: BLOCKED (core share capability path implemented; acceptance coverage is incomplete).** Local two-tenant E2E and production builds now pass. The remaining block is demonstrated coverage for GraphQL, jobs, WebSocket revocation/expiry and cross-tenant exports, plus a defined access-request resolution/retention policy. No production services were changed.

## Existing state and evidence

- The audited base already had `ShareLink` with hashed password, expiry, max views, active, allow-export/comments flags and portal relation (`backend-nest/prisma/schema.prisma:870-912`); manager and public share routes were in `backend-nest/src/share-links/share-links.controller.ts` before this work. Portal public response filtering exists in `backend-nest/src/portals/portal.service.ts`.
- Relevant authorization surfaces include JWT REST (`backend-nest/src/auth/guards/jwt-auth.guard.ts`), GraphQL (`backend-nest/src/auth/guards/gql-auth.guard.ts`), and three realtime gateways (`backend-nest/src/realtime/realtime.gateway.ts`, `backend-nest/src/notifications/notifications.gateway.ts`, `backend-nest/src/collaboration/collaboration.service.ts`). Authenticated sockets require JWTs; public share tokens are not accepted as socket credentials.
- Browser share view is `frontend/src/app/share/[token]/page.tsx`; share-link manager components are `frontend/src/components/share-links/ShareLinksManagement.tsx` and `frontend/src/components/dashboard/ShareLinksManager.tsx`.
- The previous Phase 06 implementation was partial. It had no client assignments, dedicated client comments, persisted access-request flow, public export/comment endpoints, or cross-surface MEMBER denial. Phase 06 work audited these existing modules before extending them; no duplicate share subsystem was introduced.

## Design / ADR

**Decision:** Keep the existing `ShareLink` as the durable capability root and extend it with explicit client assignments and separate guest comments/access requests. Every public operation re-reads the link, portal deletion state, expiry, assignment, password and per-capability flag. Share responses use an allowlist and `no-store`; sensitive query paths are redacted from logs/traces. Client `MEMBER` sessions cannot call agency APIs or join agency realtime; only a currently assigned client can use a client-only link. Anonymous bearer links retain their existing view behavior.

A client-only link must target a private portal; publishing is rejected while active client-only links exist. Public links remain bearer capabilities. Public comments are separated from staff comments to avoid staff identity impersonation. Client socket access is deliberately unsupported; public read/comments/export are HTTP capability operations. Revocation and expiry are checked on each such HTTP operation, so no positive cache can continue granting access.

## Modified files

Changes are present in the working tree and include:

- `backend-nest/prisma/schema.prisma` and `backend-nest/prisma/migrations/20261124180000_share_capability_entitlements/migration.sql`: `ShareLinkAssignment`, `SharedPortalComment`, `ShareAccessRequest`, status enum and foreign keys/indexes.
- `backend-nest/src/share-links/share-links.service.ts`, `share-links.controller.ts`, `share-links.module.ts`, `dto/share-link.dto.ts`, `backend-nest/src/auth/guards/optional-jwt-auth.guard.ts`: assignment and manager checks, password/capability enforcement, public allowlisted access/export/comments, access requests, management/review/removal routes, optional client identity, and no-store responses.
- `backend-nest/src/auth/guards/jwt-auth.guard.ts`, `gql-auth.guard.ts`, `agency-role.guard.ts`; protected controllers/resolvers include portals, widgets, comments, exports, workspaces, integrations, API keys and billing. `MEMBER` is restricted to auth self-service and assigned public share links.
- `backend-nest/src/realtime/realtime.gateway.ts`, `notifications.gateway.ts`, `collaboration/collaboration.service.ts`, `backend-nest/src/portals/portal.service.ts`: client socket denial, portal soft-delete room revocation, private-portal/client-link invariant.
- `backend-nest/src/common/utils/sensitive-path.ts` and HTTP logger, exception filter, response/correlation/trace/audit/request-context/security middleware: strip share bearer tokens and query strings from sensitive paths.
- `frontend/src/app/share/[token]/page.tsx`, `frontend/src/app/auth/login/page.tsx`, `frontend/src/lib/enterprise-api.ts`, `frontend/src/components/share-links/ShareLinksManagement.tsx`, `frontend/src/components/dashboard/ShareLinksManager.tsx`: request/recover states, assigned-client login return path, no-store share operations, client assignment and manager UI.
- `frontend/src/app/dashboard/page.tsx`, `frontend/src/hooks/useNotifications.ts`: client accounts now get an explanatory shared-portal landing state and do not call agency APIs or open denied realtime sockets.
- `e2e/tests/smoke.spec.ts`: agency/client/guest workflow, negative access cases, recorded diagnostics and safe screenshot handling.

## Migration notes

Migration `20261124180000_share_capability_entitlements` creates new tables and enum only. It was applied by the smoke runner to its disposable Postgres database. Existing links require no backfill: the assignment table starts empty and preserves existing bearer-link semantics. Foreign keys cascade comments/assignments with link deletion and workspace deletion; access-request link deletion sets the relation null while retaining tenant-scoped request data. No production database was accessed. Rollback in production should use a reviewed forward migration or restore plan; do not drop these tables while rows may exist.

## API and UI contracts

- Management routes remain under `/api/v1/share-links`; owner/admin checks apply to create/list/update/delete/rotate, assignments, access request queue/review and guest-comment moderation. Assignment IDs must identify `MEMBER` users in the same workspace.
- Public routes: `GET /share-links/public/:token/check`, `POST .../access`, `POST .../export`, `POST .../comments/list`, `POST .../comments`, and `POST .../request-access`. All return `Cache-Control: no-store, private`. Export and comments require link capability flags; assigned client links require the current authenticated assigned client. Anonymous bearer links continue supporting their configured capabilities.
- Public DTO is an explicit field allowlist. Integration credentials/config, workspace IDs, bearer tokens, private notes and internal pricing are excluded. Demo metrics are fictional and labeled as demo.
- Guest comment records use a display name, content and timestamp in `SharedPortalComment`; they do not create staff `Comment` records. Link/password/expired/revoked states are recoverable in `/share/:token`. The member dashboard explains how to open the link provided by the agency; it does not expose agency navigation.
- Access request endpoint is enumeration-resistant and deduplicates pending email/link requests. Current review action marks the request `REVIEWED`; it does not grant access automatically, send email or create/assign a link. Copy in the UI currently reports submission; agency review remains manual.

## Verification performed (actual exits)

- Backend focused tests: `npm run test:ci -- --runTestsByPath src/portals/portal.service.spec.ts src/portals/portal.service.tenant.spec.ts src/share-links/share-links.service.security.spec.ts src/common/utils/sensitive-path.spec.ts src/auth/guards/jwt-auth.guard.policy.spec.ts --runInBand` — **exit 0**, 5 suites / 21 tests passed.
- Backend `npm run typecheck` — **exit 0**.
- Backend `npm run build` — **exit 0**.
- Backend `npm run prisma:validate` — **exit 0**.
- Frontend `npm run typecheck` — **exit 0**.
- Frontend `npm run build -- --webpack` — normal sandbox invocation **exit 1** (`EPERM` creating `.next/server/app/billing`); elevated retry **exit 0**, webpack compilation, TS check and 61 static pages completed. The first attempt was a filesystem permission restriction.
- E2E `npm run test:smoke` — first two attempts **exit 1** (first CORS preflight from an unnecessary request `Cache-Control` header; second strict locator matched both inline alert and route announcer). Both issues were fixed. Latest run against disposable Postgres/Redis with Docker Compose **exit 0**, **2 passed**; it applied migrations, ran test DB integration (1 suite / 1 test passed), and tore containers/network down. The smoke records steps, sanitized API response/status, console errors, request failures and screenshots on failure under `e2e/test-results/smoke-artifacts/`. No live OAuth credentials were used; provider login is explicitly unavailable, while local password fixtures run without keys.
- `git diff --check` — previously **exit 0**; rerun after final edits before merge.

## Security / tenant review

- Two fixture workspaces are used. The smoke verifies the second workspace cannot read a guessed portal ID (403), cannot assign a client from another workspace, and guest cannot use a client-only link. An assigned client can load its assigned portal, while direct agency REST paths for comments/export/keys/billing return 403. Unauthenticated staff comment and PDF export routes return 401. Password, expiry, rotation, request review, public comments/export and response field exclusions are exercised.
- JWT and GraphQL guards reject `MEMBER` for agency surfaces, but automated negative tests do not yet cover every REST/GraphQL/job/socket/export route with guessed IDs. Socket guard rejects members and anonymous share tokens; socket expiry/link rotation is not independently exercised in the smoke. Portal soft-delete room eviction is present, but link-specific realtime is intentionally not offered.
- Public access uses no-store headers and server-side durable checks. Client-only links have no valid anonymous access. Link IDs and user IDs are tenant-checked. A successful request-access acknowledgement intentionally does not reveal whether a token exists.
- Added diagnostics redact share bearer URLs/query tokens and clear password fields before screenshots. Do not attach unredacted Playwright traces or raw access logs to external issues.

## Data privacy

Access request email/message and guest display name/comment are personal data. They are tenant-scoped; requests/comments are readable by the authorized workspace managers or link capability as appropriate. Retention/deletion policy and notice text are not implemented. Define retention and erasure behavior before broad rollout. No secrets are present in fixtures or documentation; fictional `.invalid` users and `PulseDemo!2026` are local-only deterministic test data.

## Manual smoke steps

1. Start backend and frontend using the repository local/test guide; run `cd e2e && npm run test:smoke` with Docker Desktop available. The test starts and tears down the disposable DB/cache.
2. Sign in as `owner@northstar.invalid` with the local fixture password and create the demo portal; verify the response says demo and client metrics say fictional demo data.
3. Create a private/password link with export/comments, verify wrong password is recoverable, correct password returns only allowlisted fields, guest comment is separated from staff comments, and export excludes workspace IDs/secrets.
4. Create a client-only link for the fixture client. Verify anonymous denial, client sign-in and access, then check agency APIs deny the client and a different workspace cannot be assigned.
5. Rotate the bearer link and verify old check/comment/export paths fail. Verify expired link view is unavailable and no-store response headers remain present.
6. Submit access request and review it as owner. Current behavior records/reviews only; the manager must separately assign a member or issue another link.

## Rollback

Code rollback is a coordinated revert of the Phase 06 files listed above. The migration is additive but data-bearing; reverting the application while leaving tables is safe. Do not drop migration-created tables after real requests/comments/assignments exist. To reverse schema later, first export/retain needed request/comment records according to approved privacy retention, revoke assignments/links, then use a DBA-reviewed migration. No external provider, deployment, production setting, or production data was touched.

## Unverified assumptions / remaining blockers

- Access review recipient, approval semantics, email notification, PII retention and erasure policy need product/privacy decisions.
- Smoke does not yet explicitly prove guessed-ID denial across GraphQL, queued jobs, socket subscriptions, and every export route, or that an already-connected socket loses entitlement after link expiry/rotation. Current public share links do not establish socket sessions; clients are rejected from agency sockets.
- A test of the 401/403 behavior relies on fixture app routes and has not covered all possible resolvers/controllers.
- Provider OAuth is not live-verified; no provider key is needed for mock/demo/local contracts.
- Redis emits connection errors during smoke teardown after test containers stop; the run exits 0 and containers are removed. This is teardown noise, not successful evidence about Redis reconnect behavior.

## Before phase 07

Complete an explicit permission matrix and negative tests for GraphQL, each job processor, every realtime subscription, export downloads, revoked cached reads and concurrent revocation. Decide access-request review/assignment automation and privacy retention. Then rerun the disposable smoke and targeted test suite after any changes. Keep this phase marked **BLOCKED** until those acceptance gaps are demonstrated.

