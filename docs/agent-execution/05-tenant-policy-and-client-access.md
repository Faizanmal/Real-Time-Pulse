# Phase 05 — Tenant policy and client access

**Status: BLOCKED for the requested acceptance criteria.** This phase adds safe portal revocation semantics and prevents deleted portals from being returned through the inspected REST, GraphQL, export, report, and WebSocket admission paths. The repository still has no explicit portal-to-client assignment model, several WebSocket events do not recheck active membership, and the full permission matrix is not enforced or tested across every surface. No claim of complete tenant/client isolation is made.

## Existing implementation and evidence

- `Portal` is tenant-owned by `workspaceId`, unique per workspace by slug, and has no prior deletion timestamp (`backend-nest/prisma/schema.prisma:419-465`). `WorkspaceMemberRole` has OWNER/ADMIN/EDITOR/VIEWER, while the legacy user role enum has OWNER/ADMIN/MEMBER (`backend-nest/prisma/schema.prisma:119-123,708-750`). Neither schema provides portal assignment to an invited client.
- REST portal endpoints use `JwtAuthGuard`; controller methods pass the authenticated user's workspace and ID into the service (`backend-nest/src/portals/portal.controller.ts:34-108`). The service checks workspace ownership on key reads/updates and OWNER/ADMIN on deletion, but previously hard-deleted portal rows and queried public shares without an active/deleted condition (`backend-nest/src/portals/portal.service.ts:264-443`).
- The frontend portal page calls the delete endpoint and removes the deleted item from its local list after success (`frontend/src/app/dashboard/portals/page.tsx:74-83`). It does not define a client-to-portal assignment or granular role matrix.
- CacheService already caches portal/widget data; its prior portal invalidation covered only portal cache keys (`backend-nest/src/cache/cache.service.ts:39-50,79-105,130-159`). Collaboration history/activity/chat are separately cached under portal-specific keys (`backend-nest/src/collaboration/collaboration.service.ts:150-199,210-268`).
- WebSocket portal join checks a portal by `id + workspaceId`, and subsequent collaboration messages include portal IDs (`backend-nest/src/collaboration/collaboration.gateway.ts:135-196,236-499`). The prior authorization helper did not filter deleted portals (`backend-nest/src/collaboration/collaboration.service.ts:53-68`); message handlers do not all repeat access checks after joining.
- GraphQL portal queries and mutations are implemented in `backend-nest/src/graphql/resolvers/portal.resolver.ts`. They had no deleted-row filters and the delete mutation performed a hard delete (`portal.resolver.ts:46-160,202-295`). Other GraphQL resolvers were not audited exhaustively.
- Export endpoints are authenticated and pass workspace context (`backend-nest/src/exports/export.controller.ts:19-104`); export queries previously selected portals/widgets by workspace without an active-state condition (`backend-nest/src/exports/export.service.ts:20-35,100-114,149-164,240-258`). The report worker accepts optional workspace/portal IDs (`backend-nest/src/jobs/jobs.service.ts:15-22`) and loads report rows in `backend-nest/src/jobs/processors/report-queue.processor.ts:63-134`.
- GraphQL exists (for example `backend-nest/src/graphql/resolvers/portal.resolver.ts:1-5,39-57`); this is not an absence-of-GraphQL case. No verified invitation-to-portal authorization contract was found.
- The deterministic test fixture creates two fictional workspaces, owners, a same-workspace `MEMBER` client account, and a private portal in the other workspace (`backend-nest/prisma/seed-test-fixtures.ts:30-89`). The fixture does not assign portals to clients.

## Design / ADR

1. Add a nullable `Portal.deletedAt` field. Null means active; a timestamp means revoked/deleted. This is additive and requires no existing-row backfill.
2. Keep REST route shapes and deletion response unchanged. REST deletion atomically marks the portal deleted/private and rotates its share token; active reads and public share resolution require `deletedAt: null`.
3. Retain portal/widget records for recovery and audit. Invalidate portal, widget, and known portal collaboration cache keys when deleting. Do not cascade-delete child data.
4. Apply the same active-state filter to portal GraphQL reads/update/delete, portal exports, portal-bound report jobs, and WebSocket admission. This does not itself solve client assignment or forcibly evict already joined sockets.
5. Do not introduce a guessed client model or permission semantics without a product contract. Until an explicit invite/assignment workflow is designed, treat the broader “assigned portals only” requirement as blocked.

## Modified files

- `backend-nest/prisma/schema.prisma` — nullable `Portal.deletedAt` and tenant/deletion index.
- `backend-nest/prisma/migrations/20261124100000_portal_soft_delete/migration.sql` — additive column and index.
- `backend-nest/src/portals/portal.service.ts` — active-row filters, soft delete, private/token revocation, cache invalidation, active count, and stale/cross-workspace handling.
- `backend-nest/src/portals/portal.module.ts` — explicit cache module dependency.
- `backend-nest/src/cache/cache.service.ts` — portal invalidation now also clears supplied widget and portal collaboration cache keys.
- `backend-nest/src/graphql/resolvers/portal.resolver.ts` — active-row filters and soft delete for GraphQL portal delete; requires OWNER/ADMIN for deletion and clears cache.
- `backend-nest/src/exports/export.service.ts` — portal/widget export queries reject deleted parents.
- `backend-nest/src/jobs/processors/report-queue.processor.ts` — portal-scoped report rejects deleted/missing/cross-workspace portals; performance reports filter deleted portals.
- `backend-nest/src/collaboration/collaboration.service.ts` — join-time portal check excludes deleted portals.
- `backend-nest/src/portals/portal.service.spec.ts`, `portal.service.tenant.spec.ts` — regressions for revoked public share, cross-workspace guessed ID, soft deletion, share rotation/privacy, and cache invalidation.

No frontend source was changed. Existing portal list UI consumes the filtered REST list and existing delete flow remains route-compatible; the client assignment/access UI does not exist and is not represented as implemented.

## Migration and compatibility notes

The migration adds a nullable timestamp and index only. Existing portals remain active (`deletedAt IS NULL`); no backfill or data rewrite is needed. The migration was applied to the guarded disposable `pulse_test` database. The schema retains the existing unique `(workspaceId, slug)` constraint, so a soft-deleted slug remains reserved. Recreating it requires an explicit restore/slug-reuse product decision.

REST DELETE remains `204`; a deleted portal now becomes private, receives a new unguessable share token, and is omitted from active reads. Old share URLs resolve as not found. GraphQL delete remains boolean but now soft-deletes and applies OWNER/ADMIN role checks. This GraphQL role behavior has not received dedicated resolver tests; review for compatibility before release.

Rollback should be a forward fix or restore the previous release only after evaluating the security impact: old code ignores `deletedAt` and could surface retained rows through authenticated workspace reads. Do not drop the column or restore old share tokens. The additive column can safely remain unused during application rollback, but a previous application version is not a safe security rollback for revoked portals.

## API and UI contracts

| Surface | Contract after this change | Authorization status |
|---|---|---|
| REST `GET /portals`, `GET /portals/:id` | Active portals only; cross-workspace ID remains forbidden on the REST ID route. | Workspace membership check exists; no client assignment filtering. |
| REST `DELETE /portals/:id` | Same `204`; soft-revokes, privatizes, rotates share token, invalidates relevant caches. | OWNER/ADMIN enforced in service. |
| REST `GET /portals/share/:token[/view]` | Only active public portals resolve. | Public share tokens remain bearer links by existing contract; not equivalent to assigned-client authorization. |
| GraphQL portal reads | Active portal rows only. | Workspace scope exists; client-specific assignment and broad role checks are not implemented. |
| GraphQL delete | Boolean response; soft-revokes and invalidates cache. | Resolver now permits OWNER/ADMIN only; unverified against all caller role shapes. |
| Portal/widget exports | Deleted portal IDs produce not found. | Workspace scoping exists; client assignment filtering absent. |
| Portal-bound report job | Rejects missing/deleted/cross-workspace portal IDs at execution; performance query excludes deleted rows. | Jobs are trusted internal inputs; actor/assignment authorization is not persisted in job payload. |
| WebSocket | New joins reject deleted portal IDs. | Already joined sockets are not evicted and event handlers do not all reauthorize. |
| UI | Existing delete action removes the row after success; list API omits tombstones. | No client invite/assignment screen or full role-driven action visibility. |

No new metrics were added. Existing monitoring is unchanged; a counter for portal revocation/cache invalidation failures should be added with the future authorization event flow.

## Test commands and actual output

Environment: Node `v26.13.1`, npm `11.20.0`.

| Command | Exit | Output/result |
|---|---:|---|
| `cd backend-nest; npm run prisma:validate` | 0 | Prisma schema valid. |
| `cd backend-nest; node_modules/.bin/prisma generate` | 0 | Prisma Client v7.10.1 generated. |
| `cd backend-nest; npm run test:ci -- --runTestsByPath src/portals/portal.service.spec.ts src/portals/portal.service.tenant.spec.ts --runInBand` | 0 | 2 suites, 6 tests passed. |
| `cd backend-nest; npm run test:db:up` (sandbox attempt) | 1 | Docker API pipe permission denied. |
| `cd backend-nest; npm run test:db:up` (approved local Docker access) | 0 | Loopback-only no-volume Postgres/Redis healthy. |
| `cd backend-nest; $env:TEST_DATABASE_URL=...pulse_test...; npm run test:db:migrate` | 0 | All 13 migration directories applied, including `20261124100000_portal_soft_delete`. |
| `cd backend-nest; $env:TEST_DATABASE_URL=...pulse_test...; npm run test:integration` | 0 | Seeded two fictional tenants/client; integration suite 1/1 passed; no pending migrations. |
| `cd backend-nest; npm run typecheck` | 0 | TypeScript check passed. |
| `cd backend-nest; npm run build` | 0 | Nest build passed. |
| `cd backend-nest; npm run test:db:down` (approved local Docker access) | 0 | Disposable no-volume Postgres/Redis containers and network removed. |
| `git diff --check` | 0 | No whitespace errors; Git emitted only existing LF/CRLF notices. |

The broad repository lint and legacy Jest baseline remain blocked as recorded in earlier phase reports. No dedicated GraphQL, export, job, or WebSocket revocation integration tests were run in this phase.

## Manual smoke steps

1. Follow `docs/agent-execution/01-clean-room-boot.md` to start only the disposable test profile and load the fictional fixture.
2. Create a portal with an OWNER/ADMIN; save its share token. Confirm it appears in the REST list and public share route only when public.
3. Delete it through REST. Confirm the existing UI removes it, REST list no longer includes it, direct REST ID access is not found, and old public token is not found. Confirm the portal row remains with `deletedAt`, `isPublic=false`, and a rotated token in the local disposable DB.
4. Try the same guessed ID with the other tenant. Confirm no row mutation or export is possible.
5. Verify the GraphQL deleted-row queries return no portal and mutation soft-deletes; verify portal export and queued portal report reject a deleted ID.
6. Join a portal over WebSocket, then delete it while connected. This is currently an expected gap: an already joined socket may remain in the room until it disconnects. Do not treat this as passing revocation behavior.

## Security and tenant review

REST create/list/read/update/remove/share-token operations use current workspace context; deletion still requires OWNER/ADMIN. Cross-workspace REST removal is regression-tested and denied before mutation. Tombstones are filtered from REST list/public shares, exports, GraphQL portal queries, report portal checks, and new WebSocket joins. Cache invalidation covers known portal, supplied widget, and collaboration history/activity/chat keys.

The acceptance requirement is not satisfied: an invited client account is currently a `User` with legacy `MEMBER` role, and there is no persistent portal assignment relation or invite acceptance workflow. `findAll` and GraphQL workspace portal queries still scope to the workspace, not an allowlist of assigned portal IDs. Public share URLs remain deliberately public bearer links. WebSocket membership is checked only at join and active connections are not forcibly evicted. There is no completed negative-test matrix for every REST/GraphQL/WS/job/export operation or another tenant's resource ID. Agency-private pricing/notes/settings/token filtering for a client is therefore unverified.

## Data privacy

Test data is fictional (`.invalid` addresses) and all DB operations were constrained to loopback `pulse_test`. No provider keys, production records, live OAuth, or external services were used. Portal child records remain stored after revocation for recovery; public access is disabled and the old share token is rotated. Operational retention/purge duration is not defined and needs a data-retention decision. No secret was added to docs or test output.

## Unverified assumptions and blockers

- Product has not specified whether client accounts are same-workspace members or distinct tenant identities, nor what each invited role may see/do.
- No portal assignment data model, invite management contract, client-facing loading/empty/error UI, or visible permission matrix exists.
- GraphQL resolver mutations/queries were changed but have no targeted contract tests; role values and the resolver's GraphQL user shape need verification.
- Existing WebSocket rooms can outlive portal revocation; cache invalidation does not evict connected clients or prevent every already-joined event handler from broadcasting.
- Jobs do not persist the requesting actor or assigned-portal authorization context; checks only ensure a portal is currently active in the supplied workspace.
- Full repository lint and legacy Jest issues remain unresolved (see Phase 01/04 reports).

**Before Phase 06:** agree and document the client identity/invitation/assignment model and per-role permission matrix; then implement assignment-aware REST/GraphQL/UI access and revocation. Add per-message WebSocket reauthorization or active socket eviction, persist actor/authorization context for jobs, and add two-tenant negative tests for every REST, GraphQL, WS, job, and export path. Add UI role visibility states, operational metrics, privacy retention, and a safe restore/purge policy. Keep this phase **BLOCKED** until those tests demonstrate the specified boundary.
