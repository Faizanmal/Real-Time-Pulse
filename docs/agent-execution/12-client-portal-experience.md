# Phase 12 — Client portal experience

**Status: PASS** — schema → service → API → client UI → unit/security suites → disposable-DB Playwright smoke all completed with recorded exit codes. Fictional fixture data only; no live provider keys or production changes.

## Existing state and evidence inventory

- `frontend/src/app/v/[shareToken]/page.tsx` loads public and authenticated draft-preview portals with loading (`role="status"`), retryable unavailable/403/401 states, and wires `ClientPortalSummary`.
- `frontend/src/app/share/[token]/page.tsx` handles password, expiry/revocation, assigned-only denial, and request-access separately from a generic 403-as-expired mislabel.
- `backend-nest/src/portals/portal.service.ts` builds the client-safe public projection (`buildClientProjection`), draft preview (owner/admin), and owner/admin client-summary updates that set `clientUpdateAt`.
- `backend-nest/src/portals/client-portal-status.ts` aggregates feed health (`CURRENT` / `STALE` / `ATTENTION` / `NO_DATA`) from visible widget integrations and portal-scoped metrics using the shared 24h stale threshold; oldest sync wins.
- `backend-nest/src/share-links/share-links.service.ts` returns the same client summary under password, expiry, view-limit, and assignment checks.
- `frontend/src/app/dashboard/layout.tsx` blocks `MEMBER` from agency dashboard chrome (“Agency access required”); JWT/agency role guards remain the authoritative API boundary.
- `backend-nest/prisma/schema.prisma` (`Portal`) holds nullable `clientStatus`, `clientStatusNote`, `latestDeliverable`, `pendingDecision`, `clientUpdateAt`.
- Prior phase left this report **BLOCKED** on Docker; this run started Docker Desktop, moved the disposable Redis host port off a Windows Hyper-V exclusion, and executed the browser suite.

## Design / ADR

1. Reuse existing `Portal`, publish snapshot, public projection, and share-link capability flows. No second portal/status module.
2. Agency owner/admin writes explicit client-visible summary fields via workspace-scoped `PATCH /portals/:id`. Do not infer deliverables from workspace-wide `ClientReport` rows (no portal FK; would risk cross-client disclosure).
3. Feed status is computed only from currently visible widgets/mappings; missing values stay missing (no zero fill). Aggregate timestamps use the oldest source.
4. Public `/v/:token` and capability `/share/:token` stay separate; they share `ClientPortalSummary`.
5. Frontend dashboard role gate is UX-only; API guards deny client/agency-private reads with 403.
6. Security middleware no longer treats bare `;` in JSON bodies as command injection (false positive on normal prose such as demo portal descriptions). Stronger URL/query patterns remain.

## Modified files

### Phase 12 product surface (already present; verified/extended)

- `backend-nest/prisma/schema.prisma`
- `backend-nest/prisma/migrations/20261126150000_client_portal_experience/migration.sql`
- `backend-nest/src/portals/client-portal-status.ts`
- `backend-nest/src/portals/client-portal-status.spec.ts`
- `backend-nest/src/portals/dto/portal.dto.ts`
- `backend-nest/src/portals/portal.service.ts`
- `backend-nest/src/portals/portal-snapshot.ts`
- `backend-nest/src/portals/portal.service.client-update.spec.ts`
- `backend-nest/src/portals/portal.service.publish.spec.ts`
- `backend-nest/src/share-links/share-links.service.ts`
- `backend-nest/src/share-links/share-links.service.security.spec.ts`
- `frontend/src/components/client-portal/ClientPortalSummary.tsx`
- `frontend/src/app/v/[shareToken]/page.tsx`
- `frontend/src/app/share/[token]/page.tsx`
- `frontend/src/app/dashboard/layout.tsx`
- `frontend/src/app/dashboard/portals/[id]/edit/page.tsx`
- `frontend/src/types/index.ts`
- `frontend/src/lib/api/portals.ts`
- `frontend/src/lib/api-client.ts`
- `e2e/tests/smoke.spec.ts`

### Fixes required to unblock acceptance in this environment

- `backend-nest/docker-compose.test.yml` — default `TEST_REDIS_PORT` `56379` → `57379` (Windows Hyper-V excluded range)
- `backend-nest/scripts/start-smoke-api.cjs` — same Redis default
- `e2e/playwright.smoke.config.ts` — same Redis default; smoke timeout 180s; expect timeout 15s
- `backend-nest/src/widgets/dto/widget.dto.ts` — align create `type` enum with Prisma `WidgetType` (reject invalid types with 400)
- `backend-nest/src/common/middleware/security.middleware.ts` — drop bare `;` from command-injection body scan
- `frontend/src/app/dashboard/portals/[id]/edit/page.tsx` — do not spread array `layout` into object when saving widget order
- `frontend/src/components/client-portal/ClientPortalSummary.tsx` — explicit `role="region"`
- `e2e/tests/smoke.spec.ts` — Phase 12 client UX before builder; `TEXT_BLOCK` widget; robust status/preview assertions; CORS-aware preview mock

## Migration notes

Additive nullable columns only (`clientStatus`, `clientStatusNote`, `latestDeliverable`, `pendingDecision`, `clientUpdateAt`). No backfill; empty UI copy until an agency publishes values. Applied automatically by the disposable smoke/API bootstrap against loopback `pulse_test`. Backward compatible: older app versions ignore new columns. Rollback = redeploy prior app; keep columns. Do not drop after client updates exist. No production migration or settings change was performed.

## API and UI contracts

- `PATCH /api/v1/portals/:id` — optional `clientStatus` (`ON_TRACK` | `NEEDS_ATTENTION` | `BLOCKED` | `COMPLETED`), `clientStatusNote` (≤500), `latestDeliverable` / `pendingDecision` (≤240). Owner/admin + workspace scope; sets `clientUpdateAt`.
- `GET /api/v1/portals/share/:shareToken/view` — client-safe projection including summary + `feedStatus` `{ health, lastSyncedAt, lastValidDataAt, sourceCount }`. `Cache-Control: no-store`.
- `GET /api/v1/portals/:id/preview` — same projection for owner/admin draft preview.
- `POST /api/v1/share-links/public/:token/access` — same summary nested under capability checks.
- `/v/:shareToken` and `/share/:token` — status, last sync, latest deliverable, pending decision, client update time, feed health, loading/error/empty copy.
- `/dashboard/*` — `MEMBER` sees only “Agency access required”; direct `/api/v1/portals` and `/api/v1/analytics/metric-mappings` return 403.
- Builder labels client-update fields as client-visible; publish copies them into the snapshot.

## Test commands and actual results

| Command | Exit | Notes |
|---|---|---|
| `cd backend-nest; node ./scripts/prisma-runner.cjs generate` | **0** | Prisma Client generated |
| `cd backend-nest; node ./scripts/prisma-runner.cjs validate` | **0** | Schema valid |
| `cd backend-nest; npm run typecheck -- --pretty false` | **0** | |
| `cd frontend; npm run typecheck -- --pretty false` | **0** | |
| `cd backend-nest; npm test -- --runInBand src/portals/client-portal-status.spec.ts src/portals/portal.service.client-update.spec.ts src/portals/portal.service.publish.spec.ts src/portals/portal.service.tenant.spec.ts src/portals/portal.service.spec.ts src/share-links/share-links.service.security.spec.ts` | **0** | 6 suites / 29 tests |
| `cd e2e; npm exec playwright test -- --config=playwright.smoke.config.ts --list` | **0** | 2 tests discovered |
| `cd e2e; npm run test:smoke -- --grep "agency creates persistent client portal"` | **0** | 1 passed (≈46.9s test / ≈1.8m wall) — client summary UX, 403 agency denial, mobile/desktop widths, loading under delayed network, share security, builder, tenant/duplicate |
| `cd e2e; npm run test:smoke -- --grep "invalid client share"` | **0** | 1 passed — unavailable/alert recovery |

No live provider verification. No production deploy.

## Manual smoke steps (optional follow-up)

1. Sign in as fictional owner; set status/deliverable/decision; publish; open `/v/:token` and a password share link.
2. Confirm empty vs filled summary copy; stale/attention badges with old sync fixtures.
3. Sign in as client fixture; `/dashboard/portals` shows access block; API 403s as above.
4. Expired and assigned-only links show distinct copy from wrong password.
5. Mobile/desktop + accessibility tree for region/dt/`<time>`/status-alert roles.

## Security, tenant and data privacy review

- Client summary mutations require owner/admin and workspace-scoped portal lookup.
- Feed aggregates expose health/timestamps/source counts only — no integration IDs, credentials, error text, or workspace IDs.
- Client text is explicitly labelled client-visible in the builder and copied only into client-safe projections/snapshots.
- Dashboard gate is not the security boundary; server guards deny MEMBER/agency-private and cross-tenant IDs (smoke verified 403).
- Expired/revoked/assigned-only/password failures remain distinct and fail closed.
- All demo content is fictional; tokens in fixtures are marked non-real.

## Rollback

Retain additive columns; roll back application code. Old clients ignore new fields. Do not make private portals public solely to expose new summary fields. No production rollout occurred.

## Unverified assumptions

- Screen-reader coverage is Playwright role/name assertions, not a human AT session.
- No CPU/slow-device throttle beyond delayed network loading.
- Per-provider freshness SLAs beyond the 24h metric threshold are not modeled.
- Human usability study outside Playwright was not run; acceptance UX criteria were demonstrated in automated browser scenarios with fictional data.

## Before the next phase

Phase 12 acceptance is satisfied in local/disposable environments. Next phase may proceed. Prefer keeping Redis test port configurable (`TEST_REDIS_PORT`) on Windows hosts with Hyper-V exclusions. If a later phase needs downloadable deliverables, add an explicit portal-scoped artifact relation rather than joining workspace reports.
