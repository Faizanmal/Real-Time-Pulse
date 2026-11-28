# Backup, encryption and restore procedure

**Operational status: BLOCKED.** Repository backup code is not a verified PostgreSQL backup/PITR system. Do not use the app-level restore endpoints for a real restore. No production backup provider, retention, encryption-at-rest, WAL archiving, restore target, RPO or RTO has been verified.

## What exists in this repository

- `backend-nest/src/backup/backup.service.ts:31-34,60-82` reads whole-table data into a JSON-like application snapshot, encrypts it with AES-GCM, stores it in a raw `backups` table, and calls a replication method that only logs and schedules a message (`:280-295`). No Prisma model or migration creating `backups` exists in the repository.
- Its default `BACKUP_ENCRYPTION_KEY` is random per process (`:31`); absent a configured durable key, a later process cannot decrypt old snapshots. The `.env.example` does not provision this key.
- The code labeled point-in-time recovery (`:137-158`) selects the latest application snapshot before the timestamp; it does not restore PostgreSQL WAL to a point in time. The snapshot currently selects full `integrations`, `users`, and `workspaces` tables (`:208-219`), and restore upserts dashboard rows in a transaction (`:225-246`).
- A second implementation, `backend-nest/src/common/services/backup.service.ts`, writes files under `backup.directory` and metadata JSON (`:32-90`); its encryption fallback is the constant string `default-backup-key` (`:223-229`). Its non-dry-run restore path only logs the tables/record counts that it would restore (`:294-348`).
- Local `docker-compose.yml` has named development volumes for Postgres/Redis, not backups (`:5-43`). The Kubernetes manifests contain the app deployment and database secret reference, but no database/backup/PITR resource definition (`k8s/deployments.yaml:20-84`). These do not prove what the deployed managed database provider supports.

## Required backup design before use

1. Confirm the production database provider, supported managed backup/PITR feature, backup region, retention, immutable-copy options, encryption-at-rest/KMS key ownership and restore limits with the service owner. Record the provider-generated backup ID and UTC restore point without copying secrets into this file.
2. Set explicit, approved RPO/RTO targets. They are currently unknown; do not infer them from daily application snapshots.
3. Treat platform database backups as the source of truth. Keep application-level tenant exports separate from database disaster recovery. Application exports must be schema-versioned, tenant-scoped and explicitly authorized; they must not contain raw OAuth credentials.
4. Provision keys in a managed secret/KMS store with documented access, rotation, recovery and separation from the backup storage account. Never use the random process key or `default-backup-key` fallback for durable backups.
5. Keep restore endpoints disabled/unreachable until authentication, break-glass authorization, audit logging, target isolation, destructive-operation review and a tested rollback are in place. No production setting has been changed by this audit.

## Disposable restore drill (not yet run)

Use the database provider's supported clone/PITR-to-new-instance operation, or a local disposable Postgres instance. Do not use `POST /api/v1/backups/:id/restore`, `POST /api/v1/backups/restore/point-in-time`, or `POST /api/v1/backups` for this drill: those routes use the unverified application backup implementation.

1. Obtain approval for a disposable target in an isolated project/account. Give it a unique identifier such as `pulse_restore_drill_YYYYMMDD`; deny inbound public access and production credentials. Assert the connection host, database name and cloud resource ID before any restore command. Reject the run if any value points to production or a shared environment.
2. Populate a fresh source fixture only with fictional Northstar/Juniper records, one fixture portal, and a synthetic integration token. Record expected row counts and a checksum of selected non-secret fixture values.
3. Create a provider-managed snapshot (or use its synthetic snapshot fixture), enable WAL/PITR if supported, and note the backup/restore timestamp. Never upload a real customer export to an unapproved environment.
4. Restore **to a new target**, never in-place. Keep source read-only and leave DNS/app connections untouched. Apply schema migration checks only in a separate migration rehearsal after the restored clone is isolated.
5. Verify counts, fixture checksum, tenant separation, no plaintext/ciphertext token in query output, representative read-only app checks and the observed restore duration. Record actual RPO/RTO from timestamps; a failed check is a failed drill.
6. Preserve redacted logs and the provider operation ID, then delete the disposable target using its exact resource ID and confirm it is gone. Keep the source snapshot according to approved retention.

## Rollback and incident handling

- A failed clone drill is rolled back by deleting only the exact disposable target; never promote it or repoint production traffic.
- For a real incident, preserve the source and take a fresh snapshot before remediation if the provider permits. Restore a separate clone, compare and obtain explicit change-owner approval before any production cutover.
- If the backup encryption key is unavailable or rotated, do not guess/default a key or overwrite ciphertext. Preserve the artifact, recover the approved KMS key version, and validate decryption on the isolated clone.
- A bad schema migration should use a reviewed forward fix or provider PITR clone after data-loss impact analysis; application backup restore is not an approved rollback mechanism.

## Verification record

No restore drill, production/provider backup inspection, KMS key inspection, or PITR operation was performed. Host checks found no `postgres`, `initdb`, `pg_dump`, `pg_restore`, or `psql` executables. Access to Windows Service Control Manager was denied (probe exit 1). Docker-based disposable restore was unavailable on this host. See [Phase 27 execution report](../agent-execution/27-observability-sre.md).
