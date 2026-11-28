# Phase 10 — Realtime transport

**Status: BLOCKED** — local hardening and focused tests are complete, but multi-instance delivery/presence and restart-safe event revisions are not demonstrated. Do not treat this phase as accepted.

## Existing state (audited before edits)

- `backend-nest/src/realtime/realtime.gateway.ts:104-168` authenticates a socket, resolves its user in the token workspace, rejects client-member role access, and joins workspace/user rooms. `:203-255` scopes portal joins and leaves to the authenticated workspace. `:256-288` filters widget subscriptions by workspace. Before this phase, `:294-381` broadcast cursor, selection, and typing messages to a caller-supplied portal room without requiring current room membership.
- The same gateway kept socket/presence state in local maps (`:64-68`) and created a cleanup interval without retaining its handle (`:98-102`).
- `backend-nest/src/collaboration/collaboration.gateway.ts:135-195` checked access at portal join. Its cursor, lock, change, presence, feed, chat, and WebRTC handlers (`:236-503`) accepted caller-supplied portal IDs without checking the current socket room and fresh tenant grant. Presence and locks were local maps (`:55-63`); disconnect previously removed a user regardless of other tabs.
- `backend-nest/src/notifications/notifications.gateway.ts:48-111` authenticated against a workspace user and rejected client-member accounts. Portal subscription at `:133-147` scoped the lookup to that workspace. Notifications payloads were raw and portal unsubscribe did not check current room membership (`:149-156`).
- `backend-nest/src/cqrs/event-sourcing.service.ts:15-53` already contains a versioned domain-event envelope. Realtime broadcasts did not use it. `backend-nest/src/cache/redis.service.ts` already provided the app's Redis connection; no Socket.IO Redis adapter was installed.
- `frontend/src/contexts/socket-context.tsx:193-210,225-236,297-340` managed event handlers and portal/widget subscriptions. It already rejoined portal rooms after reconnect, but did not replay desired widget rooms and appended duplicate viewer entries.
- `frontend/src/hooks/useOptimisticMutation.ts:88-158` restored whole-query snapshots after errors, including a delayed rollback that could overwrite newer cache data. Its string-or-array query key was always wrapped in another array.

## Design / ADR

1. Preserve existing Socket.IO event names and top-level fields. Add `eventId`, `version: 1`, `revision`, `tenantId`, `resourceType`, `resourceId`, and ISO `serverTimestamp` to realtime event payloads. Existing source event IDs are retained when supplied; otherwise an ID is generated. Revisions are currently process-local and therefore are not a restart-safe sequence.
2. Treat room membership as necessary but not sufficient authorization. Collaboration handlers recheck `verifyPortalAccess(userId, workspaceId, portalId)` and require the live socket to be in that portal room. Main realtime handlers require an authenticated connection and joined portal room for cursor/selection/typing; widget IDs are checked against the portal and workspace.
3. Use optional `operationId` values for chat and widget-change retries. Redis `SADD` plus TTL is claimed atomically through Lua; a repeated claim returns a duplicate acknowledgement without persisting or emitting the side effect. Legacy clients without `operationId` remain wire-compatible, but cannot receive this idempotency guarantee. Notification room broadcasts also receive the additive envelope.
4. Keep stable event handlers in the frontend, remove their Socket.IO listeners on cleanup, replay desired widget subscriptions on connect, suppress duplicate/older enveloped events per listener/resource, deduplicate viewer presence, and clear viewer state on disconnect. Old un-enveloped events remain accepted for backwards compatibility.
5. Optimistic rollback restores a snapshot only if that mutation's optimistic value is still the current cache value. Otherwise it invalidates/refetches rather than overwriting a later write. Query keys now preserve array form. The same conditional rollback is used by list and batch helpers.

**Decision:** no Prisma schema change was justified for these additive transport changes. Adding a database migration without durable event sequencing or a shared Socket.IO adapter would not solve the identified cross-instance gap. The existing CQRS envelope remains separate; realtime uses its own small shared helper instead of creating a duplicate CQRS module.

## Modified files

- `backend-nest/src/realtime/realtime-event.ts` — additive v1 event envelope and revision generator.
- `backend-nest/src/realtime/realtime.gateway.ts` — tenant-scoped room checks, widget ownership validation, retained cleanup timer, event metadata.
- `backend-nest/src/collaboration/collaboration.gateway.ts` — room and fresh tenant authorization, multi-tab presence retention, event metadata, retry claims.
- `backend-nest/src/collaboration/collaboration.service.ts` — Redis-backed operation claim entry point.
- `backend-nest/src/cache/redis.service.ts`, `backend-nest/src/cache/cache.service.ts` — atomic idempotency-token claim with TTL.
- `backend-nest/src/notifications/notifications.gateway.ts` — envelope metadata and safe portal unsubscribe validation.
- `frontend/src/contexts/socket-context.tsx` — stable/cleaned event subscriptions, stale/duplicate envelope filtering, reconnect widget replay, idempotent viewer updates.
- `frontend/src/hooks/useOptimisticMutation.ts` — safe conditional rollback and query-key normalization across mutation helpers.
- `backend-nest/src/realtime/realtime-event.spec.ts`, `backend-nest/src/realtime/realtime.gateway.spec.ts`, `backend-nest/src/collaboration/collaboration.gateway.spec.ts` — envelope, guessed-ID/tenant denial, retry, and multi-tab cases.
- `backend-nest/src/notifications/notifications.gateway.spec.ts` — notifications portal guessed-ID denial.
- `docs/agent-execution/10-realtime-transport.md` — this report.

The repository had extensive unrelated pre-existing working-tree changes from earlier phases. Those files were left untouched; no generated diff was reverted.

## Migration notes

- No schema migration or backfill. Redis claims expire after 24 hours. Redis persistence/replication behavior was not verified in this run.
- Event fields are additive. A legacy consumer should continue to read its prior fields; new consumers should treat missing envelope fields as a legacy event.
- Clients that need retry deduplication must send the same opaque `operationId` on every retry of a chat or widget-change operation. The field is optional to avoid breaking older clients.
- Rollback: revert only the phase 10 changes listed above. No persisted business records need transformation. Reverting while clients still send `operationId` is safe; older handlers ignore the extra field.

## API and UI contracts

### Socket event envelope

```ts
{
  eventId: string,
  version: 1,
  revision: number,
  tenantId: string | null,
  resourceType: 'workspace' | 'portal' | 'widget' | 'user' | 'system',
  resourceId: string,
  serverTimestamp: string // ISO 8601
  // Existing event-specific fields remain at the top level.
}
```

The event ID is stable only when the source supplies it (for supported retry operations, that is the client `operationId`). The current revision generator is process-local. Tenant IDs may be null for old service broadcasts whose tenant context was not cached or included in their payload; receiving a room message is not authorization to access other APIs.

### Authorization and retry acknowledgements

- Portal join retains its existing success/error behavior. A cross-workspace or guessed ID is denied without joining.
- Widget subscribe acknowledges only found widget IDs in the authenticated workspace. Unsubscribe only removes rooms and validates its payload.
- Collaboration events require current portal membership and a fresh workspace grant. Invalid or unauthorized events return `{ success: false, error: 'Access denied' }` or do not emit.
- Chat/change requests may include `operationId` (1–128 characters). A repeated token returns `{ success: true, duplicate: true }` and produces no second write/broadcast.

### UI state

- Active portal room: viewer list updates are unique by `userId`; room join is replayed on reconnect; disconnect clears viewer state.
- Active widget rooms are retained locally and replayed after reconnect. Explicit unsubscribe removes the IDs from desired state.
- Enveloped socket events with a seen event ID or a non-increasing resource revision are dropped per listener. Legacy payloads without an envelope are passed through.
- Failed optimistic mutations restore only their own still-current optimistic value; overlapping changes trigger query invalidation for server reconciliation.

## Test commands and output

Commands run from the indicated package directories; exit codes are actual observed process codes.

| Command | Exit | Result |
|---|---:|---|
| `backend-nest: npm run typecheck` | 0 | `tsc --noEmit` passed. |
| `frontend: npm run typecheck` | 0 | `tsc --noEmit` passed. |
| `backend-nest: npm test -- --runInBand src/realtime/realtime-event.spec.ts src/realtime/realtime.gateway.spec.ts src/collaboration/collaboration.gateway.spec.ts src/notifications/notifications.gateway.spec.ts` | 0 | 4 suites, 10 tests passed. |
| `backend-nest: npm exec eslint -- src/realtime/realtime-event.ts` | 0 | Envelope helper lint passed. |
| `frontend: npm run lint -- src/contexts/socket-context.tsx src/hooks/useOptimisticMutation.ts` | 0 | 0 errors, 7 warnings (existing long functions/dependency warning and complexity warnings). |
| focused backend ESLint on both gateways and specs | 1 | Failed with 226 errors and 3 warnings, predominantly formatting and unsafe-argument findings across the large audited gateway files. No full lint cleanup was attempted because it would reformat unrelated existing gateway code. |
| `git diff --check -- <phase 10 files>` | 0 | No whitespace errors. |

Tests use fictional IDs (`tenant-a`, `portal-a`, `widget-tenant-b`) and mocked services. No provider keys or live external actions are used. There is no frontend test runner configured in `frontend/package.json`; optimistic rollback and browser reconnect behavior were typechecked/linted but not exercised by an automated frontend test.

## Manual smoke steps

1. Start local Docker services and the API/frontend using existing local scripts; use fictional seeded users/portals only.
2. Connect an agency user in tenant A. Attempt `portal:join` with a tenant B portal ID and `widget:subscribe` with a tenant B widget ID. Confirm no room join and only tenant A widget IDs in the acknowledgement.
3. Join an authorized portal, then emit cursor, chat, activity, lock, change, and WebRTC events after leaving or from a different portal room. Confirm no broadcast/write occurs.
4. Send a chat/change twice with the same `operationId`; confirm the second acknowledgement is duplicate and does not create a second stored item or broadcast.
5. Open two tabs for the same user and portal. Disconnect one tab; confirm the other remains in viewer/presence state. Disconnect both; confirm presence is removed.
6. Disconnect/reconnect with active widget subscriptions; confirm the subscription acknowledgement returns the same authorized IDs and UI does not duplicate viewers or apply an older revision.
7. With two independently running backend instances, repeat steps 2–6. This is a required gate and is expected to fail until a shared Socket.IO adapter and distributed presence are configured.

## Security / tenant review

- Preserved the pre-existing rule that client-member accounts cannot join the main `/realtime` workspace transport; assigned share-link access remains a separate mechanism.
- Collaboration authorization resolves both portal and user under the socket token's workspace, and event handlers recheck before doing work. Guessable IDs do not grant room membership.
- Widget subscription queries filter through the portal's workspace. Widget event handlers optionally check that widget belongs to the supplied portal and workspace.
- Redis idempotency keys are partitioned by portal and user; arbitrary operation IDs are length-limited. No tokens or provider credentials are placed in event payloads.
- Unresolved: Socket.IO rooms and presence remain process-local because `@socket.io/redis-adapter` is absent. Cross-instance portal/widget room authorization, delivery, and presence are not proven. Multi-instance worker restart can reset the process-local revision sequence. These are acceptance blockers.

## Data privacy

Event metadata contains internal tenant/resource IDs and random event IDs. Existing user names/avatars and event payload data remain as before. No new PII is persisted. Redis operation tokens contain opaque operation IDs partitioned by tenant resource/user and expire after 24 hours; do not put message text or secrets in the ID.

## Rollback

Revert the files listed in “Modified files” using a reviewable source-control patch. No DB rollback is needed. Disable/revert operation-ID claims only if Redis behavior causes issues; legacy requests without an ID remain supported. Do not remove an active Redis adapter setting during rollback because this phase did not add one.

## Unverified assumptions

- Redis is shared across API workers and its Lua scripting and TTL behavior are available in the configured production-like Redis version.
- The API's Socket.IO adapter remains the default in single-instance deployment; no external sticky-session or shared-adapter configuration is in this repository.
- Browser behavior for socket disconnect/reconnect and optimistic overlapping failures still needs automated UI coverage.
- Source services may omit `tenantId` on broadcasts; such envelopes can have a null tenant field even though their room resource is explicit.
- The current event revision resets with the Node process, and generated IDs are not stable for retries unless the operation supplies `operationId`.

## Before the next phase

Do not start Phase 11 until the team adds/configures a shared Socket.IO Redis adapter and distributed presence, makes resource revisions restart-safe, and requires or supplies stable operation IDs for retryable side effects. Add a local two-instance integration suite (no real provider keys) covering unauthorized portal/widget/tenant joins, reconnect, multi-tab presence, duplicate delivery, worker restart, stale event rejection, and Redis claim behavior; also add a frontend test runner and exercise failed overlapping optimistic writes. Re-run the focused tests, both typechecks, and lint after those changes. Phase 10 remains **BLOCKED** until those checks pass.
