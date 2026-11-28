# Phase 19 — Alerting and escalation

**Status: PASS for the scoped local implementation; live channel/provider delivery remains unverified.** No production settings were changed and no live notification was sent.

## Existing state and evidence

- `backend-nest/prisma/schema.prisma:1282-1370` already defined workspace alerts and alert history, but did not persist per-channel retry state or an event-level idempotency key.
- `backend-nest/src/monitoring/alerting.service.ts:35-39,147-164` held a separate in-memory alert rules/history implementation. Process restarts therefore could not use it as durable delivery state.
- `backend-nest/src/data-health/health-monitor.service.ts:309-320` had a one-hour throttle around data-health notifications, without delivery-attempt state.
- The existing alerts API at `backend-nest/src/alerts/alerts.controller.ts:29-101` already used JWT auth and accepted the authenticated workspace. The service was the right extension point; no parallel alert module was introduced.
- `backend-nest/src/jobs/processors/data-sync-queue.processor.ts:88,190-236` already recognized completed duplicate jobs and had workspace-scoped integration lookup. Sync failures/recoveries were not yet sent to the persistent alert rules.
- Before this phase, the alert pages used divergent API shapes. The existing alert API client/UI are now aligned in `frontend/src/lib/api/alerts.ts:1-78` and `frontend/src/components/alerts/AlertsManager.tsx:26-228`.

## Scoped plan executed

Extend the existing alert and history records with an additive migration; connect stable failure/recovery signal IDs from the sync worker; persist occurrence and per-channel delivery states; add bounded safe retries and authorized manual retry; expose reason/source/freshness/next action in the existing UI; cover flapping, partial failure, duplicate/restarted job delivery and tenant isolation with fictional fixtures; validate the migration and document limitations.

## Design / ADR

1. **One durable path:** workspace metric evaluation lives in `AlertsService` and the existing Alert models. Legacy monitoring and data-health alert mechanisms remain for compatibility and are not replaced in this phase.
2. **Idempotency:** each signal carries a deterministic `eventId`; `(alertId,eventId)` is unique. Evaluation uses a serializable transaction; duplicate key conflicts are treated as already processed. Each history occurrence has at most one delivery per channel via a unique key.
3. **Flapping:** the latest firing state is retained. Non-critical events inside the configured suppression window are recorded as `SUPPRESSED` without sending. Recovery produces a `RESOLVED` history occurrence. An explicitly configured `CRITICAL` rule bypasses this suppression policy.
4. **Delivery:** attempts transition through `PENDING → SENDING → SENT|FAILED`, use bounded exponential backoff (maximum five automatic attempts), and expose safe error codes and attempt timestamps. HTTP webhook dispatch includes an idempotency key. A crash or DB failure after remote acceptance can leave a row `SENDING`; it is deliberately not retried automatically because acceptance is ambiguous and duplicate notification is possible. Operator reconciliation is required for that state.
5. **Safe removal:** deleting an alert archives it (`isActive=false`, `deletedAt`) so delivery and history are retained. Existing API fields such as `notificationsSent` are mirrored for compatibility. Alert reads omit configured webhook URLs/secrets.
6. **Test endpoint:** “test alert” now verifies accessible configuration and explicitly returns `deliverySent: false`; it cannot accidentally contact a live channel.

## Modified files

- `backend-nest/prisma/schema.prisma`
- `backend-nest/prisma/migrations/20261127190000_alerting_escalation_delivery/migration.sql`
- `backend-nest/src/alerts/alerts.service.ts`
- `backend-nest/src/alerts/alerts.controller.ts`
- `backend-nest/src/alerts/dto/alert.dto.ts`
- `backend-nest/src/alerts/alerts.service.spec.ts`
- `backend-nest/src/alerts/alerts.controller.e2e.spec.ts`
- `backend-nest/src/jobs/processors/data-sync-queue.processor.ts`
- `backend-nest/src/jobs/processors/data-sync-queue.processor.spec.ts`
- `backend-nest/src/email/templates/alert-notification.hbs`
- `frontend/src/lib/api/alerts.ts`
- `frontend/src/components/alerts/AlertsManager.tsx`
- `frontend/src/app/alerts/page.tsx`
- `frontend/src/app/dashboard/alerts/page.tsx`
- This report.

## Migration and compatibility notes

The migration is additive: new alert fields have safe defaults or are nullable; existing history rows receive `source='legacy'`, `severity=MEDIUM`, `status=TRIGGERED`, and `suppressedCount=0`; `eventId` remains nullable for old rows. New unique constraints permit legacy null event IDs. No historical rows are deleted or rewritten beyond these defaults. Alert deletion is now soft archival. Rollback should disable new alert evaluation/worker integration first, then revert application code. Keep the added columns/tables during rollback; dropping delivery/history data would be destructive. A later cleanup migration requires an explicit retention decision and backup.

Clean disposable Postgres verification applied all 24 migrations including `20261127190000_alerting_escalation_delivery` successfully. The test database was loopback-bound Docker Compose only (`127.0.0.1:16432`); no production database was used.

## API and UI contracts

- Authenticated `GET /alerts` returns only active workspace-visible records, up to five recent history entries per alert and each entry’s per-channel delivery summaries. `GET /alerts/:id` and `/alerts/:id/history` remain workspace scoped.
- `POST /alerts` / `PATCH /alerts/:id` accept a validated metric condition, severity, channels and suppression window. Workspace and creator are always taken from JWT context; input-supplied scope fields are not persisted. Portal/widget IDs are checked against the same workspace.
- `POST /alerts/:id/deliveries/:deliveryId/retry` retries only a failed/pending delivery belonging to the requested alert and authenticated workspace. Sent is idempotently returned; `SENDING` conflicts; cross-workspace IDs return not found.
- Occurrence fields include `eventId`, `source`, `severity`, `freshnessAt`, `reason`, `nextAction`, status and suppressed count. Delivery fields include channel, status, attempt count, last-attempt/next-attempt/sent timestamps, and a non-sensitive error code.
- The UI provides loading, retryable error, empty, create/edit and delivery retry states. It shows active/firing/failed-delivery counts; source/rule; last evaluated time; severity; freshness; why it fired; next action; occurrence and delivery status; attempt count and sent/error metadata. Channel secrets are masked in edit mode and not returned by reads. `test alert` does not send a message.

## Tests and check results

All commands below were run locally against the repository state in this workspace. Exit codes are actual process exit codes.

| Command | Exit | Result |
|---|---:|---|
| `backend-nest: npm run prisma:validate` | 0 | Prisma schema valid |
| `backend-nest: npm run test:db:down` | 0 | Removed only the disposable test stack |
| `backend-nest: npm run test:db:up` | 0 | Disposable Postgres/Redis healthy |
| `backend-nest: npm run test:db:migrate` with loopback `TEST_DATABASE_URL` | 0 | All 24 migrations applied on a fresh DB |
| `backend-nest: npm test -- --runInBand src/alerts/alerts.service.spec.ts src/alerts/alerts.controller.e2e.spec.ts src/jobs/processors/data-sync-queue.processor.spec.ts` | 0 | 3 suites, 18 tests passed |
| `backend-nest: npm run typecheck -- --pretty false` | 0 | Passed |
| `backend-nest: npm run build` | 0 | Passed |
| `frontend: npm run typecheck -- --pretty false` | 0 | Passed |
| `frontend: npm exec -- eslint src/components/alerts/AlertsManager.tsx src/lib/api/alerts.ts src/app/alerts/page.tsx src/app/dashboard/alerts/page.tsx` | 0 | No errors; 2 warnings (component exceeds configured max-lines and effect-triggered initial loading state update) |
| `git diff --check` | 0 | Passed; Git printed line-ending normalization warnings |

Regression coverage includes flapping suppression/resolution, critical bypass, duplicate alert event, failed channel then timed retry, workspace/portal/widget/delivery ID denial, forged workspace/creator fields, archived history retention, secret omission, provider partial failure with a restarted worker, resumed cursor, duplicate completed job delivery and workspace-scoped job lookup. Fixtures use fictional GitHub identifiers and `.invalid` email/webhook domains; no keys are required.

## Manual smoke steps

1. In a local environment, create a workspace rule for `provider.sync_failures >= 1`, choose a non-critical severity, and configure only a local mock channel.
2. Feed a fictional failed sync signal and verify the alert shows provider source, prior valid-data freshness, failure reason and next action.
3. Replay the same job/event ID and confirm history/delivery counts do not increase. Simulate recovery, then another failure inside the suppression interval; verify recovery is visible and the repeat is recorded as suppressed without sending.
4. Configure a `CRITICAL` rule and verify it records/sends despite suppression. Do this only with a local mock sink.
5. Make the mock channel fail once, then succeed; verify `FAILED`, attempt count, due time and eventual `SENT`. Exercise manual retry for a failed delivery.
6. Restart/reconstruct the worker after partial sync failure; verify it resumes from the stored cursor and a completed duplicate does not fetch or signal again.
7. Authenticate as another workspace and request the first workspace alert/delivery IDs, including a portal/widget-scoped rule; verify not-found/denial and no data is returned.
8. Verify webhook values are not present in API reads, and “test alert” performs no outbound request.

## Security and tenant review

Every alert/delivery read and retry includes authenticated workspace scope. Alert creation uses explicit field allowlisting and authenticated workspace/user relations. Portal/widget resources are validated against the same workspace. Sync job integration lookup is scoped by both integration ID and workspace ID. Controller tests exercise guessable alert and delivery IDs and role denial. Provider tokens and raw records are not included in alert signals; failure reasons are truncated and use safe failure codes. Channel errors are represented with a generic code, not provider response bodies. Configured webhooks remain outbound destinations as in the existing product; this change does not validate arbitrary URLs against internal/metadata networks. Confirm the existing outbound URL policy before enabling user-supplied webhook delivery in a new environment.

## Data privacy

History stores metric value, source label, provider freshness timestamp, explanation and action. It does not store raw provider payloads, email message bodies, tokens, or raw channel error responses. Local fixtures are synthetic. Webhook/Slack URLs are omitted from API responses. Existing delivery addresses and alert configuration retain their existing access/retention policies; no new export or third-party processing was introduced.

## Rollback

Disable sync-to-alert signal emission and alert retry scheduling, then revert the application/UI changes. Keep the additive tables and columns to preserve event and delivery evidence. Re-enable old alert UI/API behavior if needed. Do not drop `alert_deliveries` or `alert_history` without a reviewed backup and retention plan. No deployment or production setting changes were made.

## Unverified assumptions and limits

- The worker hook is connected to the existing `DataSyncQueueProcessor` path (GitHub in current implementation). Other provider-specific workers must call the same `recordSyncSignal` contract before claiming provider-wide coverage.
- Real SMTP, Slack and webhook acceptance/retry semantics were not validated; only local mocks and contract behavior were tested. No provider credentials were supplied or needed.
- At-least-once remote delivery cannot be guaranteed exactly once for arbitrary channels. Webhooks receive an idempotency key, but receiver support varies. Ambiguous `SENDING` rows require operator review and can remain stuck; add a reconciliation workflow before enabling high-volume delivery.
- The integration tests are mocked and the clean DB migration was exercised. A deployed multi-instance worker and real provider/notification path remain unverified.
- Existing legacy in-memory monitoring and data-health alert paths still operate independently; unifying them is out of this phase's scope.
- Frontend lint reports two non-blocking warnings listed above.

## Next phase prerequisites

Before Phase 20, decide whether to expand the sync alert hook to every provider worker, review/confirm the outbound webhook destination policy, and define an operator reconciliation action for ambiguous `SENDING` deliveries. If external channels are to be activated, validate them in an authorized gated staging workspace with test destinations and confirm receiver idempotency; do not use real client notifications by default.
