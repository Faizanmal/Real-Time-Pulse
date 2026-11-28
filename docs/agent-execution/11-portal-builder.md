# Phase 11 — Portal builder

**Status: BLOCKED** — implementation and focused contract/security checks are present, but the acceptance browser path has not been executed: the Docker Desktop Linux engine is unavailable in this environment. Do not treat the phase as complete until the smoke test passes.

## Existing state and evidence inventory

- `backend-nest/prisma/schema.prisma:679-739` defines `Portal` with mutable `layout`, `isPublic` and `shareToken`; it had no draft/published snapshot fields. `Widget.order` already exists at `:776`.
- `backend-nest/src/portals/portal.service.ts:70-180` already creates a clearly marked, fictional demo portal and widget. `:405-432` returns workspace-scoped portal lists. The public view projection is at `:187-208`; portal update mutates the current record in `:472-520`.
- `backend-nest/src/portals/portal.controller.ts:29-33` provides the authenticated demo flow; CRUD routes use workspace/agency guards. Public share routes are separately unguarded and use the token capability.
- `frontend/src/components/portals/PortalsSystem.tsx` was an incomplete list experience with fabricated status/usage values. `frontend/src/app/dashboard/portals/new/page.tsx` had a basic create form and sample-portal entry point.
- `frontend/src/app/v/[shareToken]/page.tsx` already handled loading, empty and unavailable states, but there was no builder route under `frontend/src/app/dashboard/portals/[id]/edit/`.
- `e2e/tests/smoke.spec.ts:22-` already exercises the fictional portal and share-link security flow. Playwright runs against disposable Postgres/Redis services via `e2e/playwright.smoke.config.ts` and `backend-nest/scripts/start-smoke-api.cjs`.

## Design / ADR

1. Use the existing `Portal.layout` JSON for persisted widget order (`widgetOrder`). This avoids an order-only migration and makes saving the order one workspace-authorized portal update, avoiding partial multi-widget writes.
2. Add nullable `publishedSnapshot`, `publishedAt`, monotonic `publishRevision`, and `draftMode`. New publication is an allowlisted structural snapshot; private widget configuration and credentials are never copied. Existing rows default to `draftMode=false` and retain legacy live behavior.
3. Preview uses the same client-safe projection as the public view, but only via an authenticated owner/admin endpoint scoped to the current workspace. Preview can show an unpublished draft. Public draft-mode portals without a valid snapshot are denied.
4. Publication requires the caller’s expected `updatedAt`, then uses a transaction and conditional update to reject stale edits with HTTP 409. Public visibility remains independently controlled; publish does not silently turn on public access. Unpublish disables public visibility while retaining the previous snapshot for safe recovery/republication.
5. Preserve existing explicitly public legacy creation behavior for API compatibility. The normal builder creation defaults private/draft; public visibility can be selected separately. This compatibility branch is called out in code paths and report contracts.

## Modified files

- `backend-nest/prisma/schema.prisma`
- `backend-nest/prisma/migrations/20261126130000_portal_publish_snapshot/migration.sql`
- `backend-nest/src/portals/portal-snapshot.ts`
- `backend-nest/src/portals/dto/portal.dto.ts`
- `backend-nest/src/portals/portal.controller.ts`
- `backend-nest/src/portals/portal.service.ts`
- `backend-nest/src/portals/portal.service.publish.spec.ts`
- `backend-nest/src/share-links/share-links.service.ts`
- `frontend/src/app/dashboard/portals/[id]/edit/page.tsx`
- `frontend/src/app/dashboard/portals/new/page.tsx`
- `frontend/src/app/v/[shareToken]/page.tsx`
- `frontend/src/components/portals/PortalsSystem.tsx`
- `frontend/src/lib/api-client.ts`
- `frontend/src/lib/api/portals.ts`
- `frontend/src/app/dashboard/comments/page.tsx` and `frontend/src/components/analytics/MetricMappingManager.tsx` (updated existing callers to consume the actual `{ portals, total }` API contract)
- `frontend/src/types/index.ts`
- `e2e/tests/smoke.spec.ts`

Other repository files were already dirty from preceding phases; this list identifies the portal-builder touch set, not the complete worktree diff.

## Migration and compatibility notes

The migration is additive: `draftMode BOOLEAN NOT NULL DEFAULT false`, nullable `publishedSnapshot JSONB`, nullable `publishedAt TIMESTAMP(3)`, and `publishRevision INTEGER NOT NULL DEFAULT 0`. No data backfill or destructive transformation is required. Existing portals remain in legacy-live mode. New draft portals are only served publicly from a valid published snapshot. The migration has **not** been applied to a running database in this execution because the disposable Docker services could not start.

Rollback is application-first: disable builder/publish routes by rolling the application back; the previous app may ignore the added columns. Keep the additive columns and snapshot data during rollback. Do not drop the columns after publication data has been written. There is no production rollout or production settings change in this phase.

## API and UI contracts

- `GET /api/v1/portals/:id/preview` — authenticated agency owner/admin; portal is selected by both ID and authenticated workspace. Returns the client projection, `viewMode: "draft-preview"`, and no credentials/config/private notes.
- `PATCH /api/v1/portals/:id` — existing update contract; builder saves name, description, and `layout.widgetOrder` as draft changes.
- `POST /api/v1/portals/:id/publish` — body `{ expectedUpdatedAt: ISO-8601 }`; returns `portalId`, `publishedAt`, `publishRevision`, `isPublic`. Stale timestamps return 409 and do not write a snapshot.
- `POST /api/v1/portals/:id/unpublish` — workspace-scoped agency owner/admin; disables the public link and retains the snapshot.
- Public `GET /api/v1/portals/share/:shareToken/view` and authorized share-link views use the published allowlist for draft-mode portals. Existing non-draft records retain the safe legacy projection. Drafts lacking a snapshot return not-found.
- UI `/dashboard/portals/new` offers explicitly fictional local sample data. `/dashboard/portals/:id/edit` supports title/description, HTML drag/drop and keyboard reorder controls, save, authenticated client preview, publish, and separate public visibility. Loading, retry/error, empty-widget, connector-unavailable, draft and published states are exposed.
- Preview is intentionally the public-safe field projection. The app does not copy provider credentials or widget config into the snapshot or client response. Share-link permissions for comments/export continue to be governed by existing share-link contracts.

## Test commands and actual results

- `cd frontend; npm run typecheck -- --pretty false` — **exit 0**.
- `cd backend-nest; npm run typecheck -- --pretty false` — **exit 0**.
- `cd backend-nest; node ./scripts/prisma-runner.cjs validate` — **exit 0**, schema valid.
- `cd backend-nest; npm test -- --runInBand src/portals/portal.service.publish.spec.ts src/portals/portal.service.tenant.spec.ts src/portals/portal.service.spec.ts src/share-links/share-links.service.security.spec.ts` — **exit 0**, 4 suites / 23 tests passed. Covers stale publish, cross-workspace denial, client-safe allowlisting, failed fictional connector, public access and assigned-link security.
- `cd e2e; npm exec playwright test -- --config=playwright.smoke.config.ts --list` — **exit 0**, 2 tests discovered.
- `cd e2e; npm run test:smoke -- --grep "agency creates persistent client portal"` — **exit 1 before test execution**. Web server startup reported `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`; Compose could not start disposable Postgres/Redis.
- An attempted broader run including `src/widgets/widget.service.spec.ts` failed loading `@nestjs/bull` as ESM under the current Jest runtime (exit 1); the four focused portal/share suites pass separately. The widget order column already existed and builder ordering persists in `Portal.layout`, so no widget service/API changes are required by this design.

## Manual smoke steps (not executed)

1. Start Docker Desktop with the Linux engine, then run the exact Playwright smoke command above. It creates local fictional fixture records only and brings its own test database/cache.
2. Sign in with the deterministic local owner fixture and create the sample portal from the UI; confirm the fictional-data label.
3. Open the builder, reorder widgets using drag/drop and then keyboard buttons, save, reload, and verify order remains.
4. Preview before/after publishing; confirm the preview banner, client-safe fields, and no connector settings, private notes, or credential strings.
5. At a narrow viewport, check widget flow and the connector-unavailable mock state; verify public link is independent of publish and unpublish makes it unavailable.
6. Use a second tenant fixture to request the first tenant’s preview/publish endpoint; expect denial and no returned portal/widget data.

## Security, tenant and privacy review

- Preview, publish and unpublish are protected by JWT and agency-role guards; service calls independently verify owner/admin membership and use workspace predicates for portal reads/writes. A guessed cross-workspace ID is covered by focused regression tests.
- Public views use an allowlist. Snapshot fields include display name/type, provider label, ordering/layout, publication metadata, and canonical metrics; no widget `config`, integration credentials, workspace ID, or share token enters the snapshot projection.
- A broken local demo connector produces an explicit unavailable/null state; it does not become a zero. Client widget projection does not expose integration IDs. The Playwright fixture uses fictional local content and a mocked connector failure; no provider key is needed.
- No real customer data, external calls, provider credentials, deployment, or production setting changes were used.

## Unverified assumptions and blockers

- Docker Desktop’s Linux engine must be running in the execution environment. The user stated Docker was available, but the actual Docker CLI could not reach its engine pipe.
- Because browser execution was blocked, drag/drop behavior, keyboard reorder persistence, mobile rendering, connector mock rendering, and the real browser end-to-end experience remain unverified. The smoke test’s setup contract is discoverable (`--list` succeeded), but that does not replace execution.
- The portal migration has not been applied against the disposable DB, and the end-to-end fixture data path is not runtime-verified here.

## Before the next phase

Start Docker Desktop’s Linux engine, rerun the smoke command, and resolve any failing browser assertions. Confirm migration application and rollback behavior on the disposable database. Only then change this status from **BLOCKED** to **PASS** and begin the next phase.
