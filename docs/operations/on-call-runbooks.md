# On-call runbooks

These runbooks use repository-local signals and fictional fixtures. They do not imply production provider accounts, backup capability, or alert delivery was tested. Use the approved on-call channel and incident process; do not paste tokens, webhook URLs, customer payloads or backup contents into tickets/chat.

## Provider outage or connector failure

**Detect:** Integration dashboard shows `DEGRADED`/`ERROR`, a stale `lastValidDataAt`, an increased queue age/retry count, or provider-specific sync alert. The sync worker records failure and recovery signals (`backend-nest/src/jobs/processors/data-sync-queue.processor.ts:215-257`).

**First response:** Note UTC onset/provider/error code/affected workspace count. Check `GET /api/v1/health/ready`, then authorized `GET /api/v1/integrations/workspace/:workspaceId/sync-freshness`. Compare provider status from the approved status source. Pause repeated manual sync triggers if the queue is growing; do not disconnect/reconnect all tenants.

**Recover:** For a broad provider incident, preserve queued work and wait for provider recovery/backoff. For one tenant, verify its authorized connection state and ask that workspace owner to reconnect only if the stored OAuth grant is invalid. Retry one synthetic or explicitly approved connector first. Do not use real provider keys in local reproduction.

**Verify/close:** Confirm a successful SyncRun, `lastValidDataAt` advanced, error code cleared, queue age/depth trend is draining, and alert history records a resolved event. Record onset-to-success recovery time. The existing dashboard does not currently display this recovery duration; route to the SRE backlog until implemented.

## Stale dashboard or stale provider data

**Detect:** Integrations page shows `STALE`, `NEVER_SYNCED`, missing `lastUpdatedAt`, or oldest queued age is increasing. Current service marks data stale after 24 hours (`integration.service.ts:220-236`).

**First response:** Distinguish dashboard/API outage from only one provider by checking readiness and each workspace-scoped freshness item. Record `lastValidDataAt`, `lastSyncedAt`, queue oldest timestamp, and latest safe error code. Do not treat missing metrics as zero or publish stale data as current.

**Recover:** Resolve provider outage, queue worker failure or connector reauthorization according to the provider runbook. Preserve the last valid data timestamp; avoid destructive resync/cursor reset without an approved recovery plan.

**Verify/close:** Confirm fresh successful run and client-visible timestamp/health. Confirm other workspace/provider records remain unchanged. Notify affected workspace owners through the authorized incident channel.

## OAuth or identity-provider outage

**Detect:** elevated failures on `/api/v1/auth/google`, `/api/v1/auth/google/callback`, `/api/v1/auth/github`, `/api/v1/auth/github/callback`, or the configured provider connector OAuth callback; login/session refresh failures increase.

**First response:** Determine whether the outage is app callback/config, provider authorization/token endpoint, or only one integration. Check readiness and sanitized error codes. Do not rotate or print client secrets during diagnosis; don't disable CSRF/state validation.

**Recover:** Follow the provider's approved incident guidance. Preserve existing cookie sessions where valid; don't bulk revoke grants or alter redirect URIs without owner approval. Use local mocked OAuth-state tests for reproduction, never live credentials.

**Verify/close:** Complete one approved test account flow, verify state/nonce, cookie flags and callback error handling; check success/error rate and customer impact. Confirm no access/refresh token was logged.

## Leaked API, OAuth, Stripe or encryption key

**Detect:** secret scanner, provider alert, unexplained token use, or confirmed disclosure. Treat as potentially compromised; record key class and discovery time, not the value.

**Contain:** Notify security incident lead. Revoke/rotate the exact key in its owning provider using the approved break-glass account; disable affected credential if necessary. Preserve audit evidence. Do not paste the secret into this runbook, shell history, issue or chat.

**Recover:** For connector encryption keys, do not replace the key blindly: encrypted Integration rows require old-key decrypt plus controlled re-encryption and a rollback plan. Preserve old key versions until migration and restore coverage prove the new key. Revoke affected provider tokens and reauthorize impacted workspaces individually.

**Verify/close:** Search approved logs for redaction, confirm revoked credential is rejected, run mocked/fixture tests, verify encrypted rows and provider access, and record affected workspace count. Escalate any evidence of database/backup exposure as a security incident.

## Bad or partial database migration

**Detect:** migration job non-zero, schema version drift, elevated API readiness failure, failed writes or integrity alarm.

**First response:** Stop subsequent migrations and deploys; capture migration identifier, UTC time, logs and migration history. Keep source database available and avoid retrying destructive SQL blindly. Identify a read-only production snapshot strategy through the database owner.

**Recover:** Prefer reviewed forward correction when data remains valid. If restore is needed, follow [backup-and-restore.md](backup-and-restore.md) to an isolated new target first. Do not use the app backup endpoints or overwrite the original database. Require data owner and incident lead approval before any cutover.

**Verify/close:** Compare schema, row counts and tenant-level fixture/integrity checks; run readiness and critical read-only smoke. Confirm no cross-tenant data changes. Document rollback/cutover decision and resulting RPO/RTO.

## Stripe webhook or billing backlog

**Detect:** webhook error/age growth, queued billing jobs, subscription state lag, signature verification failures, or delayed invoice/customer updates. Relevant API surface includes `/api/v1/billing/webhook`, `/api/v1/billing/subscription` and `/api/v1/billing/invoices`.

**First response:** Check queue age, delivery IDs and webhook signature/error code. Separate Stripe outage from local DB/Redis outage. Do not replay a broad date range or manually issue charges/refunds.

**Recover:** Preserve event IDs and use Stripe's idempotent retry/replay mechanism only for the exact failed event after confirming its prior processing state. Keep live billing disabled in local tests; use webhook fixtures/mocks. Escalate duplicate-charge/refund risk immediately.

**Verify/close:** Confirm one event maps to one internal update, subscription/invoice state matches provider, backlog drains, and retries stop. Reconcile duplicate events and record customer impact without storing payment secrets.

## Cloud, database or regional incident

**Detect:** readiness failure, multiple services unavailable, regional provider status incident, sharp latency/error increase, or lost connectivity to managed DB/Redis/storage.

**First response:** Establish blast radius and region from approved monitoring. Avoid repeated restarts, failovers or DNS changes. Freeze unrelated deploys/migrations. Preserve logs, request IDs, and provider incident reference.

**Recover:** Follow the cloud provider's approved failover and database recovery procedure. Prefer a new isolated restore target and verify it before cutover. Coordinate with security/data owners for residency and access controls. Do not infer that Kubernetes replicas or local named volumes are backups.

**Verify/close:** Validate readiness, queue recovery, tenant isolation, data freshness and error-rate recovery. Record actual start/end, restored point, data gap and provider confirmation. Keep public customer statements to confirmed facts.

## Escalation and incident record

For every incident capture UTC detection/recovery times, affected service/provider/workspaces (count only where possible), safe error code, mitigation, customer-visible outcome, metrics before/after and follow-up owner. The repository does not define a staffed on-call roster, paging integration, or production SLO/error-budget target; confirm those with service ownership before relying on these runbooks.
