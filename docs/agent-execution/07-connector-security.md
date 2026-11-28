# Phase 07 — Connector security

**Status: BLOCKED.** The connector API no longer serializes token columns, tenant checks are exercised for another workspace’s connector ID, provider refresh/error contracts are covered with mocks, and the connector UI exposes state plus last successful sync time. However, the background data-sync processor has no real provider pagination/persistence handler, provider connect is still caller-supplied token storage rather than an OAuth authorization flow, and the current token storage path is plaintext. Acceptance is not complete; no real provider was contacted and no production database or settings were touched.

## Existing state and evidence

- The existing `Integration` model is the connector source of truth (`backend-nest/prisma/schema.prisma:258-300`): it stores `accessToken`, optional `refreshToken`, provider settings, legacy `IntegrationStatus`, `lastSyncedAt`, and `lastSyncError`. The schema comment says tokens are encrypted at the application layer, but `IntegrationService.createIntegration` previously wrote the request token fields directly (`backend-nest/src/integrations/integration.service.ts:131-153`).
- Existing connector routes and ownership checks were in `backend-nest/src/integrations/integration.controller.ts:25-112`; ID operations call `assertWorkspaceAccess` before service methods (`integration.service.ts:204-211`). The existing list selected `settings`, and the detail/create/update methods returned Prisma records, including token columns (`integration.service.ts:164-201,232-241`).
- Provider dispatch already existed in `integration.service.ts:278-460`; GitHub and Google Analytics adapters existed at `backend-nest/src/integrations/services/github.service.ts` and `google-analytics.service.ts`. Their repository/report requests did not accept a page/offset contract. Provider failure logs in adapter services passed raw error objects; MQTT logs included `brokerUrl` (`services/mqtt.service.ts`, prior lines 116-135).
- `DataSyncQueueProcessor` only handled ASANA, Google Analytics and Harvest with placeholder methods that logged integration data and returned zero as a successful sync (`backend-nest/src/jobs/processors/data-sync-queue.processor.ts`, audited before edits). It did not check the job workspace against the integration’s workspace.
- The primary connector page is `frontend/src/app/dashboard/integrations/page.tsx`; it had loading/empty views but no persistent load-error retry, showed legacy active/inactive/error only, and listed provider cards that looked clickable but were decorative. The shared `IntegrationCard` is in `frontend/src/components/ui/feature-cards.tsx`.
- Root and backend `AGENTS.md` and a separate reference-pack directory are absent in this clone. `frontend/AGENTS.md`, `docs/architecture/current-system.md`, and existing Phase 00–06 reports were read. The frontend rules require the installed Next guide; the available guide used was `frontend/node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`.

## Design / ADR

**Decision:** Keep the current `Integration` table, provider adapters, controller and queue. Add a separate connection-state enum rather than changing legacy `IntegrationStatus`, so existing services that query `ACTIVE` continue to work. Add last-valid-sync metadata and a safe, allowlisted serializer at the `IntegrationService` boundary. All provider error responses/logs should expose a stable status/category, never exception objects or credentials. Workspace IDs remain server-derived for create and are checked before every connector-ID operation.

Legacy state mapping is additive: ACTIVE → CONNECTED, ERROR → DEGRADED, EXPIRED → NEEDS_RECONNECT, INACTIVE → DISCONNECTED. `lastValidDataAt` begins as the legacy `lastSyncedAt` and is not overwritten on failed refresh/fetch/sync. Connector pages show that timestamp without claiming stored payload retention. Client-side page/offset parameters are supported by the GitHub repositories and Google Analytics report fetch adapters. OAuth refresh is supported only for GitHub and Google Analytics, using optional server environment credentials and mocked HTTP in tests.

The worker’s previous fake success is removed. Until a real paginated sync handler and durable data destination exist, queued sync attempts fail closed, mark the connector DEGRADED, and preserve the prior successful-sync timestamp. This intentionally surfaces the missing feature instead of recording a false success.

## Modified files

- `backend-nest/prisma/schema.prisma`; new additive migration `backend-nest/prisma/migrations/20261125100000_connector_security_status/migration.sql`.
- `backend-nest/src/integrations/integration.controller.ts`, `integration.service.ts`, new `connector-security.util.ts` and its spec; existing workspace access spec and new provider contract spec.
- `backend-nest/src/integrations/services/*.service.ts`: adapter errors now log only an HTTP status category, not raw provider errors. `github.service.ts` and `google-analytics.service.ts` accept bounded page/offset inputs and preserve provider response formats. `mqtt.service.ts` no longer logs a broker URL that may contain userinfo.
- `backend-nest/src/jobs/processors/data-sync-queue.processor.ts` and new processor spec; job lookup is constrained by integration ID plus workspace ID; credentials are never logged; unsupported sync no longer claims success and emits a credential-free `integration:error` workspace event.
- `backend-nest/prisma/seed-test-fixtures.ts`: adds a second tenant’s fictional connector for cross-tenant integration tests.
- `frontend/src/lib/api-client.ts`, `frontend/src/types/index.ts`, `frontend/src/app/dashboard/integrations/page.tsx`, `frontend/src/components/ui/feature-cards.tsx`, `frontend/src/hooks/useNotifications.ts`: normalize safe API state, consume credential-free `integration:error` workspace events and refresh status, show load errors/retry and last successful sync time, provide reconnect action for NEEDS_RECONNECT, and add a clearly fictional demo connector action.
- `e2e/tests/smoke.spec.ts`: checks safe connector list/detail payloads and tenant-B connector ID denial for GET, refresh, sync, fetch and disconnect.

## Migration notes

`20261125100000_connector_security_status` adds `ConnectorConnectionState`, `connectionState` (default CONNECTED), `lastValidDataAt`, and an index; it backfills from the existing `status` and `lastSyncedAt`. It does not rewrite/delete token values or existing data. The migration was applied only by the disposable smoke database. No production database was accessed.

The change is additive to old status columns. On rollback, keep the new columns/enum in place; old application code can continue using its original selected fields. Do not drop or rewrite the migration columns after real data has accumulated. The API serialization change is deliberate: credential columns, `workspaceId`, and secret-shaped settings no longer appear in integration responses. Existing clients should use status fields and provider-safe settings. Before broad rollout, inventory any clients that depended on returned credentials or opaque settings.

## API and UI contracts

| Operation | Contract |
|---|---|
| `GET /api/v1/integrations/workspace/:workspaceId` and `GET /api/v1/integrations/:id` | Existing routes, now return a safe projection: identity/provider/account display metadata, filtered settings, legacy status, `connectionState`, `statusMessage`, `lastSyncedAt`, and `lastValidDataAt`. No access/refresh tokens or workspace ID. |
| `POST /api/v1/integrations` and `/demo` | Existing create operations return the same safe projection. Workspace ID is taken from the authenticated user. Demo connector response contains no sentinel credential. |
| `PUT /api/v1/integrations/:id` | Existing settings update remains; secret-shaped fields are rejected with an actionable reconnect message. Response is sanitized. |
| `POST /api/v1/integrations/:id/refresh` | New owner/admin guarded route. Demo is local-only. GitHub and Google Analytics refresh use the matching server-side app credentials; unsupported providers or missing server configuration fail with a safe message. Rotated tokens are stored but never returned. |
| Worker `integration:error` event | Broadcast only to the integration workspace; payload is connector ID/state plus a sanitized message, without raw provider error or credentials. UI refreshes the connector status after receiving it. |
| `DELETE /api/v1/integrations/:id` | Existing deletion is the disconnect operation. It remains workspace-scoped. |
| `POST /api/v1/integrations/:id/sync`, `GET .../:id/test`, `POST .../:id/fetch` | Existing capabilities remain workspace-scoped. Fetch success advances `lastValidDataAt`; failures set DEGRADED or NEEDS_RECONNECT and preserve that timestamp. Queued sync currently reports missing-handler failure instead of false zero-item success. |
| Connector dashboard | CONNECTED/DEGRADED/NEEDS_RECONNECT/DISCONNECTED badges, actionable message, last successful sync time, loading/empty/error retry, fictional demo CTA, and reconnect control for supported providers. No credentials are rendered. |

The integration controller path was normalized from a literal `v1/integrations` segment to `integrations`, matching the repository’s URI versioning and frontend `/api/v1/integrations` contract.

## Verification performed (actual exits)

- `node ./scripts/prisma-runner.cjs generate` — **exit 0**, Prisma Client v7.10.1 generated.
- `npm run prisma:validate` — **exit 0**, schema valid.
- Focused backend tests: `npm run test:ci -- --runTestsByPath src/integrations/connector-security.util.spec.ts src/integrations/integration.service.security.spec.ts src/integrations/integration.service.contract.spec.ts src/integrations/services/demo-connector.service.spec.ts src/jobs/processors/data-sync-queue.processor.spec.ts --runInBand` — **exit 0**, 5 suites / 18 tests passed. Cases include public DTO redaction, nested/URL credentials, tenant mismatch/stale IDs, demo retry idempotence, two provider mock connect/refresh/page/disconnect contracts, rate limit, invalid grant, and last-sync timestamp preservation.
- The first focused-test attempt — **exit 1** because the test imported ESM `@nestjs/bull` through a type-only job dependency. The test harness now mocks Bull decorators and the processor uses a type-only job-data import; final run passed.
- Backend `npm run typecheck` — **exit 0**.
- Backend `npm run build` — **exit 0**.
- Frontend `npm run typecheck` — **exit 0**.
- Frontend `npm run build -- --webpack` — **exit 0**; optimized production bundle and 61 static pages generated. The build used expanded local filesystem permission after a sandboxed `.next` write had previously failed in this workspace.
- E2E, run from `e2e/` as `npm run test:smoke` — **exit 0**, 2 passed. The main agency/client smoke applied the additive migration and fixture to disposable Postgres/Redis containers and checked safe connector response fields plus tenant-B connector denial across read/refresh/sync/fetch/delete, alongside session and portal smoke assertions. The second test verified invalid client share handling. Containers/network were removed. During teardown the API logged Redis `ECONNREFUSED` retries after its disposable Redis container stopped; assertions had already passed. No provider OAuth keys were used. A first invocation from repository root exited 1 because there is no root `package.json`; rerun from `e2e/` passed.
- `git diff --check` — **exit 0** (Git printed only existing LF/CRLF conversion notices).
- Backend full lint `npm run lint -- --no-fix` — **exit 1**, 1,478 errors and 198 warnings across the repository. Targeted lint across integration/worker files — **exit 1**, 809 errors and 7 warnings (primarily Prettier and unsafe-any rules in this legacy code). Lint is not claimed as passing.

## Manual smoke steps

1. Run the repository local test setup and `cd e2e; npm run test:smoke`; the script owns the disposable Postgres/Redis lifecycle.
2. Sign in as `owner@northstar.invalid` / `PulseDemo!2026`, open Integrations, and choose **Create fictional demo connector**. Confirm it is labeled fictional and no provider account was contacted.
3. Inspect integration list/detail responses in browser devtools: verify no `accessToken`, `refreshToken`, `workspaceId`, secret-shaped setting, URL userinfo, or query token appears.
4. Verify the seeded tenant-B connector ID returns 403 for tenant A on detail, refresh, sync, fetch and delete routes.
5. With test HTTP mocks, exercise GitHub OAuth refresh and repositories page 3; exercise Google token refresh, a Google Analytics offset/limit report, 429, and `invalid_grant`. Confirm response bodies/logs contain no token values.
6. Queue an unsupported provider sync. Confirm the status becomes DEGRADED, a clear handler-not-configured message is shown, and the last successful sync timestamp is not advanced.

## Security / tenant review

- Integration controller is guarded by JWT and agency role. Workspace list path must equal the authenticated workspace; ID methods call a workspace ownership check. The worker loads with `{ id, workspaceId }` to prevent guessed/cross-tenant job IDs. Two-tenant browser smoke confirms all tested foreign connector operations return 403.
- Public integration DTO never includes credential columns or workspace ID. Secret-shaped keys are recursively removed from settings; credential userinfo/query tokens and bearer values in setting strings are redacted. Provider adapter logs include only provider and HTTP status; MQTT broker URLs are not logged.
- Refresh response returns a safe DTO. Optional OAuth app credentials are server-side only and are never required in local mocks. Live provider connection, rate-limit behavior and actual invalid-grant behavior remain unverified.
- `IntegrationService.createIntegration` still stores caller-supplied access/refresh tokens directly, matching the current column usage. This work did not read any live database or `.env` secret values. The schema’s “encrypted in application layer” comment is not supported by this service path; token-at-rest encryption and safe legacy-token transition remain a security blocker before production use.

## Data privacy

Connector account identifiers, scopes, settings and sync timestamps may be tenant-sensitive. The public projection excludes workspace ID and secrets; settings are recursively filtered, though an arbitrary opaque value can still contain data that does not look like a credential. Do not put customer payloads in settings. Provider sync data persistence/retention is not established by the existing worker; this patch does not claim to retain payloads. Test fixtures use fictional tenants/users and a `DEMO_ONLY_NO_CREDENTIAL` marker.

## Rollback

No production or external action occurred. The database migration is additive; rollback code without dropping the added enum/columns is safe. New response fields can be ignored by older clients, while omission of previously returned token fields is an intentional security contract change. For a code rollback, keep the safe serializer and log redaction if possible. Do not restore the prior worker behavior that recorded zero-item placeholder sync as success. A migration rollback must not drop the new enum/columns until deployment is fully reverted and any new status values are no longer needed.

## Unverified assumptions / blockers

- Provider connect is not an OAuth authorization-code flow: `POST /integrations` still accepts token material from the caller. No state/PKCE/callback flow was added in this phase.
- GitHub and Google Analytics support bounded page/offset fetch requests, but `DataSyncQueueProcessor` has no actual paginated fetch loop or durable destination. The worker now fails closed until a data destination and merge/idempotence semantics are defined.
- Token-at-rest encryption is not implemented in this existing connector storage path. A safe migration needs a key strategy, detection/transition of legacy plaintext values, coordinated updates to all token readers, rollback compatibility, and a decision about rotating any affected real credentials.
- The production Next build, mock provider contracts and local two-tenant E2E passed; live OAuth credentials/accounts were deliberately not used. Provider refresh endpoint responses/rate limits remain mock-verified only.
- The `DISCONNECTED` presentation maps legacy INACTIVE records; UI deletion removes the connector. A retained disconnected/audit record was not introduced.

## Before phase 08

1. Design and implement provider OAuth connect (state/PKCE/callback) for supported providers; stop accepting raw credentials from browser-facing create requests.
2. Define a durable sync target and idempotency/cursor contract, then implement actual paginated worker sync for at least GitHub and Google Analytics. Keep last-success data/timestamp on failure and add duplicate/retry tests.
3. Plan a key-backed encryption migration for existing connector tokens and update every backend token reader. Add a rollback-safe plaintext-to-ciphertext transition and rotate any production credentials only under an approved operational plan.
4. Add UI/API contract tests for CONNECTED → DEGRADED → NEEDS_RECONNECT and reconnect failure/success. Re-run mocks and disposable two-tenant E2E; perform live provider verification only with authorized test accounts.

**Final phase result: BLOCKED.** This phase should not be marked complete until the connect flow, durable paginated sync, and token-at-rest transition blockers above are resolved.
