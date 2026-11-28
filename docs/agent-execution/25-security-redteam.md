# Phase 25 — Security red team

**Status: BLOCKED for launch readiness; repository remediations implemented, rollout evidence incomplete.** Connector credential writes now use the existing AES-GCM `EncryptionService`, all identified Integration token readers support legacy and encrypted rows, and production rejects the legacy JSON-token auth flag. Focused automated tests and TypeScript/schema validation pass. The additive migration and backfill have not been exercised against a disposable database; dependency audits and a local image scan are now recorded; tenant API integration and disposable-DB rollout rehearsal remain unverified. No production setting/database was changed, no real credential/provider/third-party target was used, and no claim is made that the deployment is launch-ready.

## Existing state and evidence

- Before remediation, `POST /api/v1/integrations` persisted raw `accessToken`/`refreshToken` at `backend-nest/src/integrations/integration.service.ts:138-153`; schema columns were ordinary `String`/`Text` at `backend-nest/prisma/schema.prisma:299-305`. The existing AES-256-GCM implementation is `backend-nest/src/common/services/encryption.service.ts:6-64`.
- The standard Integration read path enforces workspace ownership and returns a public redacted projection at `backend-nest/src/integrations/integration.service.ts:252-268`. Provider fetch/refresh use this path (`:327-363,546-606`). Queue sync independently scopes by both ID and workspace at `backend-nest/src/jobs/processors/data-sync-queue.processor.ts:72-79`; health checks select integration credentials at `backend-nest/src/data-health/health-monitor.service.ts:84-99`; Teams OAuth has its own persistence/read path at `backend-nest/src/integrations/services/teams.service.ts:78-101,302-313`.
- Before remediation, `AUTH_LEGACY_TOKEN_RESPONSES=true` returned auth service token objects for signup/signin/Firebase handlers (`backend-nest/src/auth/auth.controller.ts:105-116,130-142,283-294,388-390`).
- No critical/high reproducible privilege bypass was confirmed in reviewed integration/share/session paths. Dependency and image scan results are recorded below; full tenant API tests remain outstanding.

## Scoped plan and design / ADR

1. Add an additive `tokenEncryptionVersion` marker (`0` legacy plaintext, `1` AES-GCM ciphertext); retain existing API input/output shape.
2. Encrypt new standard connector and Teams OAuth writes using the existing encryption provider; transparently decode version 0 and 1 only at trusted service boundaries. Unknown versions or invalid ciphertext fail closed.
3. Include queue worker and health monitor paths in the reader inventory. Keep reads backward compatible while a bounded optimistic-concurrency migration converts existing rows.
4. Make legacy auth token-body mode invalid in production config and keep a controller guard as defense in depth.
5. No UI contract change: UI does not receive plaintext or ciphertext credentials. No provider keys are needed for fixture-only tests.

During an explicit prepare window, set `INTEGRATION_TOKEN_ENCRYPTION_WRITE_ENABLED=false` only with `INTEGRATION_TOKEN_ENCRYPTION_ROLLOUT_PHASE=prepare`; this is a temporary compatibility option for a deployment that has not yet provisioned the encryption key. Normal behavior encrypts writes. After encryption writes begin, do not roll back to a binary that passes ciphertext to providers. Migration code is dry-run by default and uses compare-and-set on row version and `updatedAt`.

## Modified files

- `backend-nest/prisma/schema.prisma`; `backend-nest/prisma/migrations/20261128100000_integration_token_encryption_version/migration.sql` — additive format marker and database check constraint.
- `backend-nest/src/integrations/connector-security.util.ts` — shared protect/reveal format helpers and fail-closed version handling.
- `backend-nest/src/integrations/integration.service.ts`; `backend-nest/src/integrations/services/teams.service.ts`; `backend-nest/src/jobs/processors/data-sync-queue.processor.ts`; `backend-nest/src/data-health/health-monitor.service.ts` — encrypt/decrypt at identified persistence and trusted read boundaries.
- `backend-nest/src/config/validate-env.ts`; `backend-nest/src/auth/auth.controller.ts`; `backend-nest/.env.example` — production legacy-auth-flag rejection and rollout environment validation/documentation.
- `backend-nest/scripts/migrate-integration-tokens.cjs`; `backend-nest/package.json`; `backend-nest/package-lock.json` — dry-run/apply encryption, explicit decrypt-rollback commands and compatible dependency overrides. `backend-nest/Dockerfile` — supported Node 24 Trixie image, patched OS packages, non-root runtime, production-only packages and removal of unused npm tooling.
- `backend-nest/src/integrations/connector-security.util.spec.ts`; `backend-nest/src/integrations/integration-token-encryption.spec.ts`; `backend-nest/src/integrations/integration.service.contract.spec.ts`; `backend-nest/src/auth/auth.controller.session.spec.ts`; `backend-nest/src/config/validate-env.spec.ts` — format, provider mock, and production configuration regression coverage.
- `docs/agent-execution/25-security-redteam.md` — this implementation record.

## Priority remediation register

| Priority / exact endpoint | Condition and data exposed | Regression test | Rollback |
|---|---|---|---|
| P1 `POST /api/v1/integrations` | Before change, authorized connector writes stored access/refresh credentials as plaintext in Integration columns; DB/backup readers could obtain provider secrets. Now writes encrypt with AES-GCM and mark format v1; response projection excludes token fields. | `integration-token-encryption.spec.ts`, `integration.service.contract.spec.ts`: encrypted persistence, decrypt at trusted reader, null refresh, redaction, tamper/unknown version rejection. | Before any v1 writes, revert safely and leave v0. After v1 writes, only roll forward with decrypt-capable code or approved key-backed conversion; never deploy plaintext-only readers.
| P1 auth signup/signin/Firebase endpoints (`POST /api/v1/auth/signup`, `/signin`, Firebase handler) | When `AUTH_LEGACY_TOKEN_RESPONSES=true`, response body can expose access/refresh token material outside HttpOnly cookie. Production config now rejects this flag and controller blocks it. | `auth.controller.session.spec.ts`, `validate-env.spec.ts`: legacy response denied and production config rejected. | Do not re-enable token bodies. Roll back code only while production flag remains false and cookie flow is verified.
| P1 worker/health reads of Integration credentials | Queue sync or health processing must decrypt only after tenant-scoped lookup; an unscoped ID could disclose/call a foreign workspace connector. Lookup remains `{id, workspaceId}`; UI/API projection remains redacted. | Queue processor/service specs include foreign/stale IDs and retry/duplicate cases. Full two-workspace API/E2E remains unrun. | Revert only if workspace predicate and credential redaction remain; otherwise keep launch blocked and roll forward.
## Migration notes

Migration is additive: nullable-free `INTEGER NOT NULL DEFAULT 0` leaves existing rows marked legacy and the constraint permits only 0 or 1. Apply through the normal reviewed migration workflow to a disposable database first. After building backend (`npm run build`), preview with `npm run integration:tokens:plan` and an explicitly fixture-only `DATABASE_URL`/`ENCRYPTION_KEY`; apply conversion only with `npm run integration:tokens:encrypt`. The command uses batches of 100, never prints values, preserves null refresh tokens, and aborts after repeated compare-and-set conflicts. Run the plan again and assert zero version-0 rows before considering plaintext conversion complete.

Rollback before conversion: stop; version-0 rows remain readable. Rollback after encryption writes: roll forward with the compatibility reader or use the explicitly destructive-to-confidentiality `npm run integration:tokens:decrypt-rollback` only against an approved recovery target, with writes paused and a verified key. That command converts v1 to plaintext/version 0 and must not be run as routine rollback. Do not discard encryption keys or deploy old readers once any v1 row exists. Migration has **not** been applied in this environment.

## API and UI contracts

- `POST /api/v1/integrations`: request remains `{ provider, accessToken, refreshToken?, expiresAt?, settings? }`; authenticated workspace identity remains authoritative. Response remains the public Integration shape and omits credentials. Database writes now store encrypted token values plus `tokenEncryptionVersion: 1` by default.
- Connector reads, refresh, queued GitHub sync and health checks decrypt internally. Version 0 rows remain readable during rollout; unknown version/tampered ciphertext fails closed. Teams OAuth token exchange keeps its existing external provider contract.
- Auth signup/signin/Firebase: cookie-first behavior and response schema unchanged. Production with `AUTH_LEGACY_TOKEN_RESPONSES=true` now fails configuration validation and the controller refuses the legacy mode as defense in depth.
- UI: no API shape, route, loading, empty, or error contract change. Token material is not presented to the UI.

## Checks and actual results

All checks below ran locally with fictional fixture values. No DB migration/backfill command was run because no disposable DB was available/verified.

| Check | Actual exit | Result |
|---|---:|---|
| `npm run typecheck` (`backend-nest`) | **0** | `tsc --noEmit` passed. |
| `npm run build` (`backend-nest`) | **0** | Nest production compile passed. |
| `node --check scripts/migrate-integration-tokens.cjs` | **0** | Backfill utility syntax passed; this does not exercise DB behavior. |
| `npx jest --runInBand src/integrations/connector-security.util.spec.ts src/integrations/integration-token-encryption.spec.ts src/integrations/integration.service.contract.spec.ts src/auth/auth.controller.session.spec.ts src/config/validate-env.spec.ts` | **0** | 6 suites, 36 tests passed. |
| `npx jest --runInBand src/jobs/processors/data-sync-queue.processor.spec.ts src/data-health/health-monitor.service.spec.ts` | **0** | 1 suite, 6 tests passed; health-monitor spec path had no matching test file in this checkout. |
| `npm run prisma:validate` (`backend-nest`) | **0** | Prisma schema valid. |
| `npm audit --omit=dev --audit-level=moderate` (backend) | **0** | No production dependency advisories after lockfile overrides. |
| Full lockfile audits (backend/frontend/e2e) | **exit 1 with advisories** | backend 19 moderate / 0 high; frontend 2 moderate / 0 high; e2e 0. Remaining findings are dev/test scope. |
| `docker build --pull -t real-time-pulse:phase25-security-local .` (backend-nest) | **0** | Node 24 Trixie image built locally; production npm install reported 0 vulnerabilities. Image digest `sha256:e3b8cf48cf7d016de0b3168c1822ff1e7412f08229e34b025d35f5f963c06882`. |
| Docker Scout v1.28.0 high/critical scan of that digest | **0** | 996 packages; 0 critical, 0 high. |
| Docker Scout v1.28.0 full scan of that digest | **0** | 0 critical, 0 high, 1 medium, 26 low across 12 packages. Medium: Debian `tar` CVE-2025-45582 (scanner reports no fixed version); low findings are recorded by scanner. User explicitly authorized Docker package-inventory upload. Remediation: evaluate a distroless/minimal runtime image to remove unused archive tooling; verify native runtime libraries, TLS, Prisma engine and healthcheck, then rebuild/rescan. Do not purge `tar` from Debian because `dpkg` depends on it. Roll back by redeploying the prior approved digest. |
| Initial Docker engine attempt | **1** | Access failed before explicit approval; final scan ran after approval. |
| Disposable DB migration/backfill rehearsal | **NOT RUN** | No verified disposable database in this environment; migration safety and operational data counts remain unverified. |

## Manual smoke steps

1. On an authorized local runner, start the disposable database, apply migrations, and seed two fictional workspaces plus fixture Integration rows (legacy string, null refresh, encrypted marker). Never use production credentials.
2. Run `npm run integration:tokens:plan` and record counts only. Run `npm run integration:tokens:encrypt`, rerun the plan, and confirm zero legacy rows; verify fixture decryption through a test assertion without printing credential values.
3. Exercise mocked `POST /api/v1/integrations`, provider fetch/refresh, Teams OAuth persistence mock, queued sync and health check. Confirm provider mocks receive the original fictional token and API JSON excludes both plaintext and ciphertext.
4. Tamper fixture ciphertext and use unsupported marker; verify fail-closed behavior. Retry migration and duplicate sync delivery; confirm no double encryption or duplicate processing. Use workspace B's integration ID as workspace A and verify 403/404 with no provider call or mutation.
5. Start production-config validation with `AUTH_LEGACY_TOKEN_RESPONSES=true` and confirm startup validation fails; use false and confirm cookie-only route behavior.
6. On an authorized network/container runner, rerun backend/frontend/e2e lockfile audits and scan the exact digest-built image with a recorded scanner/database version. Attach raw reports and disposition any critical/high finding before launch.

## Security and tenant review

- Standard Integration access remains workspace-scoped before decryption. Queue sync lookup remains `{ id, workspaceId }`; encryption does not relax authorization. Existing tests cover a foreign workspace connector ID and stale ID.
- Ciphertext version is explicit; v1 uses the existing authenticated AES-GCM service. Invalid tags and unknown versions throw; there is no plaintext fallback for marked ciphertext.
- API response projection continues to omit tokens. Logging paths reviewed for this change log IDs/provider/error codes only; migration output reports counts only.
- Confirmed issue remediation tests cover token ciphertext writes, decrypt/read behavior, tampering, null refresh values, legacy rows, unknown version, retries, response redaction and production auth-flag denial. Full disposable API/E2E tenant test remains outstanding.
- No critical/high bypass or secret exposure was reproduced in owned local tests. At-rest protection is verified at unit/service level only; launch is blocked pending DB/API rehearsal. Container scan found zero critical/high, one medium and 26 low; dependency results are itemized in the check table.

## Data privacy

No real secrets or provider keys were read, printed, or included. Tests use fictional values. Connector credentials remain sensitive in process memory during provider calls. Encryption key provisioning, backup/recovery, rotation, access audit and existing database/backup exposure response require operational verification. No live provider, unrelated tenant, production database, or external abuse traffic was contacted.

## Rollback

- The schema addition is backward-compatible for older code at the database level because the column has a default; older binaries are **not** safe for use once encrypted v1 writes exist.
- Before any v1 writes, disable the rollout only through a reviewed config/code rollback, leaving v0 reads. Once any v1 rows exist, roll forward with v1 support or perform a controlled recovery conversion using the same key; do not deploy a plaintext-only reader.
- Auth config hardening can be reverted in code only if legacy token responses remain false; do not enable token bodies as rollback.
- No production configuration, provider account, or database was changed.

## Unverified assumptions and status

- No deployment's `AUTH_LEGACY_TOKEN_RESPONSES` or encryption key setup was inspected; this report does not infer deployed values.
- Migration SQL was validated through Prisma schema validation but not applied to PostgreSQL. Backfill dry-run/apply/rollback behavior is unverified against an actual disposable DB.
- Dependency audits and Docker Scout container scan have now run; one medium and 26 low container findings plus dev/test-only moderate dependency findings remain open and are reported explicitly.
- External secret scanning, Git history scanning, hosted log/APM review, encryption-key custody/recovery, provider token revocation/scope checks and production rollout are unverified.
- **Final result: BLOCKED.** Code-level remediation and tests are in place; launch readiness still requires disposable DB migration/backfill rehearsal, tenant/API integration tests, handling of the remaining medium container CVE, and review of dev/test advisories. This does not authorize deployment.

## Exactly what should happen before the next phase

1. On a controlled disposable Postgres environment, apply the additive migration and rehearse dry-run, encryption backfill, zero-legacy verification, tamper rejection and decrypt rollback with fictional credentials; preserve counts and exit codes.
2. Run two-workspace API/E2E tests for connector access, queue sync and auth cookie behavior, including foreign IDs, stale IDs, retry/duplicate delivery and no secret in response/log capture.
3. Decide remediation/exception for Debian tar CVE-2025-45582, review dev/test moderate dependency advisories, then repeat audits and scan against the final digest. Preserve Scout v1.28.0 results and critical/high dispositions.
4. Verify production key custody/recovery and deployed legacy-auth flag through approved release review. Keep launch blocked until evidence is reviewed; do not deploy as part of this phase.
