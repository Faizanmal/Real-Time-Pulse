# Phase 17 — Decision inbox

## Status

**PASS for local implementation and mocked verification.** No provider credentials or external notification service are used. The full Docker-backed browser run and final test output are recorded below; live provider delivery is not part of this phase.

## Existing state and audit evidence

- The portal previously exposed only a mutable `Portal.pendingDecision` string (`backend-nest/prisma/schema.prisma:743`); this did not preserve client responses or a revision-bound history.
- Existing `ShareLink` and `ShareLinkAssignment` models are in `backend-nest/prisma/schema.prisma:1183` and `:1228`. `ShareLinksService.requireCapability` rechecks link state (`backend-nest/src/share-links/share-links.service.ts:594`), and the service already applies capability gates for export/decisions (`:625` onward). These are extended rather than bypassed.
- The existing share-link API and public portal view remain the delivery surface; Phase 17 adds a capability-gated decision panel and an agency dashboard inbox. There was no existing immutable decision/approval aggregate or escalation policy, so a separate decision-inbox domain is warranted.
- Root-level `AGENTS.md` was not present. `frontend/AGENTS.md` and the repository's architecture/current-system and portal reference documents were reviewed before UI changes.

## Scoped plan and design / ADR

Extend the existing share-link capability model with an opt-in decision permission. Store a decision against the portal's published revision and canonical snapshot digest. Persist one response per decision, with a unique constraint, and append server-timestamped timeline events for request, response, withdrawal, and reminder. Client reads and responses revalidate the share link and assignment; client DTOs use an allowlist projection. Duplicate identical submissions return the original immutable response; a conflicting second answer returns a conflict. Revisions require a new agency-created decision.

Escalations are disabled by default and require explicit notification opt-in. The policy stores an IANA timezone, allowed weekdays, local business-hours window, interval and maximum reminder count. An hourly worker checks local business time and persists an in-app reminder plus timeline event transactionally. It does not send email/SMS. Conditional updates and a unique `(decisionId, ordinal)` reminder key fence duplicate/concurrent workers.

The migration is additive: existing share links default `allowDecisions=false`; no historical decision rows are synthesized. Existing `pendingDecision` behavior is retained.

## Modified files

- `backend-nest/prisma/schema.prisma`
- `backend-nest/prisma/migrations/20261127100000_decision_inbox_escalation/migration.sql`
- `backend-nest/src/app.module.ts`
- `backend-nest/src/share-links/dto/share-link.dto.ts`
- `backend-nest/src/share-links/share-links.service.ts`
- `backend-nest/src/decision-inbox/decision-inbox.module.ts`
- `backend-nest/src/decision-inbox/decision-inbox.controller.ts`
- `backend-nest/src/decision-inbox/decision-inbox.service.ts`
- `backend-nest/src/decision-inbox/decision-policy.ts`
- `backend-nest/src/decision-inbox/dto/decision-inbox.dto.ts`
- `backend-nest/src/decision-inbox/decision-policy.spec.ts`
- `backend-nest/src/decision-inbox/decision-inbox.service.spec.ts`
- `backend-nest/src/decision-inbox/decision-inbox.controller.e2e.spec.ts`
- `backend-nest/src/share-links/share-links.service.security.spec.ts`
- `frontend/src/lib/enterprise-api.ts`
- `frontend/src/components/share-links/ShareLinksManagement.tsx`
- `frontend/src/components/client-portal/ClientDecisionPanel.tsx`
- `frontend/src/app/share/[token]/page.tsx`
- `frontend/src/app/dashboard/decision-inbox/page.tsx`
- `frontend/src/app/dashboard/layout.tsx`
- `e2e/tests/smoke.spec.ts`
- This report.

## Migration notes

Apply migration `20261127100000_decision_inbox_escalation` through the repository's normal Prisma migration process. It adds decision/status enums, `share_links.allowDecisions` with a false default, decision/response/timeline/policy/reminder tables and indexes. It does not mutate or backfill existing business data. Rollback should disable the inbox and roll back the application first; dropping the new tables would delete decisions and responses, so retain the additive tables unless an approved backup and data-retention plan exists. No destructive rollback was run.

## API contract

- Agency (`JWT + AgencyRoleGuard`): `GET /api/v1/decision-inbox`, `POST /api/v1/decision-inbox`, `POST /api/v1/decision-inbox/:id/withdraw`, `GET/PATCH /api/v1/decision-inbox/policy`.
- Client (`POST`, optional JWT guard plus authenticated assigned client required): `/api/v1/share-links/public/:token/decisions/list` and `/api/v1/share-links/public/:token/decisions/:decisionId/respond`.
- Create binds the decision to the current published snapshot revision and digest. Respond requires `expectedRevision` and one of `APPROVE`, `DECLINE`, `REQUEST_CHANGES`; optional comment is stored as the immutable response. A repeated identical submission is idempotent; a different response, stale revision, expired/revoked link, disabled decision capability, or wrong client is rejected.
- Timeline events include `eventId`, `version`, `workspaceId`, `resourceType`, `resourceId`, `revision`, `eventType`, actor type and server timestamp. Public client projection strips tenant IDs, source-link/client IDs, digests, actor IDs and internal event details.
- Policy writes require `notificationOptIn=true` before enabling reminders, a valid IANA timezone and valid business hours. Reminder policy controls are per agency workspace.

## UI contract

- Agency dashboard navigation includes “Decision inbox”; page exposes loading/error/retry/empty states, linked active share targets with the decision permission, create form, pending count, policy controls, response/timeline history, stale revision indicator and withdraw action.
- Share-link management exposes the decision capability; it is off by default and remains restricted to assigned client accounts.
- Client share page displays the decision prompt/revision, available response controls only while the assigned client's link is valid and the published revision matches, a stale-version explanation otherwise, and the exact saved response/timeline after reload. Submission re-fetches state to reconcile the immutable server response.
- Reminder side effects are limited to in-app notification rows. The feature does not opt clients into email/SMS or send notifications automatically.

## Test commands and output

Commands were run locally with fictional `.invalid` identities/fixtures; no actual provider keys were required.

- `cd backend-nest; npm run prisma:validate` — **exit 0**, schema valid.
- `cd backend-nest; node ./scripts/prisma-runner.cjs generate` — **exit 0**, Prisma Client generated.
- `cd backend-nest; npm run typecheck -- --pretty false` — **exit 0**.
- `cd backend-nest; npm run build` — **exit 0**.
- `cd backend-nest; npm test -- --runInBand src/decision-inbox/decision-policy.spec.ts src/decision-inbox/decision-inbox.service.spec.ts src/share-links/share-links.service.security.spec.ts` — **exit 0**, 3 suites / 25 tests passed.
- `cd e2e; npm run test:smoke -- --grep "decision inbox records"` with local Docker access — **exit 0**, 1 Playwright scenario passed (9.5s test; 1.3m total including stack startup). It covered agency creation, client response, duplicate replay, refresh/history, stale revision, wrong client, and expired link. The run applied the current migration to its disposable database and removed the containers afterward.
- `cd frontend; npm run typecheck -- --pretty false` — **exit 0**.
- `cd frontend; npx eslint src/app/dashboard/decision-inbox/page.tsx src/components/client-portal/ClientDecisionPanel.tsx src/components/share-links/ShareLinksManagement.tsx 'src/app/share/[token]/page.tsx' src/app/dashboard/layout.tsx src/lib/enterprise-api.ts` — **exit 0**, warnings only (component size and existing effect/state patterns).
- `git diff --check` — **exit 0** (line-ending normalization warnings only).
- First `e2e` attempt without elevation — **exit 1**, Docker Desktop named-pipe access denied by sandbox. Retried with approved local Docker access; see final smoke result below.
- The controller HTTP contract suite was attempted in the restricted sandbox and failed to bind its ephemeral loopback ports (`connect EACCES`); the service/security suites and Docker browser smoke cover the authorization and response path. Do not treat this HTTP harness as passed.

## Manual smoke steps

1. Start local PostgreSQL/Redis and apply Prisma migrations; run API and frontend with local test-only config.
2. Sign in as agency owner, publish a portal snapshot, create an assigned share link, and enable “Allow decisions.” Create a decision and verify it appears with the bound revision.
3. Open the share link as its assigned client, submit an approval, reload, and verify the exact response and client timeline event persist.
4. Replay the same request and verify it is idempotent; submit a different answer and verify conflict. Publish a new revision and verify the old request is read-only/stale.
5. Try a wrong client, revoked link, expired link, and link without decision permission; verify denial and no response event.
6. Enable escalation only after checking opt-in. Use a fixture workspace timezone/business-hour window and verify out-of-hours suppression, interval/max suppression, and a single reminder on duplicate worker execution.

## Security / tenant review

Agency queries are constrained by the authenticated workspace and owner/admin roles. Client access checks active/not-expired link, `allowDecisions`, password state, workspace membership and exact client assignment. Response updates re-check link access/assignment and published revision in the transaction. Another client cannot retrieve/respond using a guessable decision ID. Unique response/reminder/event keys plus a conditional state transition provide duplicate protection. Client-facing DTOs are explicitly projected to omit workspace/link/user IDs and snapshot digests. No production deployment or live external action was performed.

## Data privacy

Decision title/prompt, response comment, decision status and reminder timestamps are stored in the agency database. Comments are user-entered and may contain sensitive content; the app renders them only in the agency workspace and the assigned client's authorized view. Password hash is rechecked server-side during response; the raw password is not persisted in decision records or timeline. Event metadata is minimized; internal `details` are not exposed in client projection. Fictional local test accounts use `.invalid` addresses.

## Rollback

Turn off decision permission on affected links and disable escalation policy, then roll back the application release. Existing share links retain their original behavior because permission defaults false. Keep additive records for audit/history. Do not drop tables or truncate response/timeline data as part of routine rollback. Re-enable by restoring the code after correcting the issue; no production flag/config was changed.

## Unverified assumptions / limitations

- No live email/SMS delivery exists or was requested; reminders are in-app only.
- The job runs hourly, so delivery timing is bounded by that cadence; actual production scheduler/worker topology remains deployment-specific.
- Live provider keys/accounts were not used. No external provider integration is involved in this feature.
- The controller's in-process HTTP test harness cannot bind ports in the restricted sandbox; it was not reported as passing.
- Frontend lint has warnings in large components/effect patterns; typecheck passes.
- The successful Playwright run printed Redis connection-reset/refused noise during teardown after the test and disposable container shutdown; process exit remained 0. This is test-harness cleanup noise, not an application assertion failure, and should be cleaned up in the smoke harness.
- Final Docker Playwright output is recorded after its run completes.

## Next phase

Before Phase 18, review the local smoke outcome and decide whether reminder delivery should remain in-app only or gain a separately consented delivery channel. Keep the additive migration and audit history; do not enable workspace escalation by default. Also repair the controller spec's ephemeral listener setup so it can run in restricted CI, then rerun that contract suite.
