# Repository forensics — Phase 00 handoff

## Human summary

The application already has a substantial NestJS/Prisma backend, Next.js UI, workspace-scoped data model, JWT-protected controllers, Socket.IO rooms, Bull queues, and numerous feature modules. The code audit found a mismatch between marketing maturity claims and implementation/setup evidence, and several local boot/test hazards. I did not add a duplicate product module or change product/schema behavior.

I added local-only setup/test scaffolding and the required audit artifacts. Compose configuration and static package/script syntax pass. The clean baseline remains **BLOCKED** because no package lockfiles or installed dependencies exist: backend/frontend builds, Prisma validation, DB migration/seed, API health, and Playwright smoke could not be verified. No production action, external provider request, migration, seed, or DB startup occurred.

## Existing implementation

- Stack: Next.js 16 frontend; NestJS 11 backend; Prisma 7 PostgreSQL adapter; Redis/Bull queues; Socket.IO realtime. Source evidence is listed in [00-repo-audit.md](./00-repo-audit.md).
- Schema owns User/Portal/Integration rows through workspace relationships (`backend-nest/prisma/schema.prisma:16-55,129-199,256-295,418-515`). Auth routes are in `backend-nest/src/auth/auth.controller.ts:45-80`; API prefix/version in `backend-nest/src/main.ts:116-123`.
- Existing auth/workspace/realtime/job implementations were inspected before adding scaffolding. Feature claims and implementation evidence are mapped in [feature-inventory.csv](../product/feature-inventory.csv).

## Design / ADR

Use existing Prisma, auth, health, jobs, and realtime modules. Keep product/schema contracts unchanged. Compose local infrastructure is explicit, loopback-only, and separated from a disposable test DB. Test fixtures are deterministic fictional `.invalid` identities and cannot be used for sign-in. The expanded evidence and diagrams are in [current-system.md](../architecture/current-system.md).

## Files changed

See the file list in [01-clean-room-boot.md](./01-clean-room-boot.md#modified-files). The complete artifact set also includes this report, [00-repo-audit.md](./00-repo-audit.md), [current-system.md](../architecture/current-system.md), and [feature-inventory.csv](../product/feature-inventory.csv).

## Migration notes and API/UI contracts

No schema migration, API change, or production setting change was made. Existing health routes infer to `/api/v1/health/live` and `/api/v1/health/ready`; sign-in remains `/api/v1/auth/signin`. The added smoke route is `/auth/login`. DB fixture migration/seed commands require the dedicated loopback `pulse_test` DB and have not run. There is no breaking contract or backfill to roll out.

## Tests and security review

Compose configuration checks passed (exit 0 for both local and test configurations); script syntax and package JSON parse passed. Backend build, frontend build, and Playwright smoke each returned exit 1 because executables/dependencies are absent. Migration, API health, and integration tests remain unrun. Exact commands/output and manual steps are in [01-clean-room-boot.md](./01-clean-room-boot.md).

New env templates contain local-only placeholder values. No live secret was confirmed by a limited targeted scan; values from suspected assignments were not printed. Test data is fictional and has no password/token. Tenant review confirms selected workspace checks, not a complete isolation audit. No secret rotation was performed.

## Rollback and assumptions

All changes are reversible local file edits. No DB or provider operation occurred. Test container removal is confined to the ephemeral Compose project; normal development volumes persist unless explicitly deleted. Node/npm support range, Prisma config resolution, migration success, and E2E behavior remain unverified. The repository has no lockfiles and dependencies are absent.

## Status and exact next step

**BLOCKED.** Before Phase 02, establish supported Node/npm versions, restore and commit package lockfiles for all three packages, install dependencies from those locks, then execute the clean-boot checklist in `01-clean-room-boot.md`: build/lint/typecheck, Prisma validate, fresh disposable DB migration and fixture, live/ready health checks, and credential-free Playwright smoke. Repair the broad legacy E2E suite before calling CI clean. No live provider credentials are required for those local checks.

## Reconciliation update — 2026-11-24

The initial audit narrative above describes the 2026-11-23 state and is not the current verification. Current 20-finding statuses and file/line evidence are refreshed in [00-repo-audit.md](./00-repo-audit.md#verification-refresh--2026-11-24). Since that snapshot, all three npm lockfiles have been created and clean `npm ci` completed locally; fresh test migrations/fixtures, build checks, and the agency/client smoke have run. Phase 01–04 reports below record what passed and what remains blocked. Production, provider accounts, and production settings were not accessed. No secrets were emitted; local fixtures are fictional.

**Current handoff:** local demo/test setup is repeatable on the tested host, while CI/runtime compatibility is not complete. Before the next phase, resolve the broad lint/Jest failures and reconcile Node 26 local testing with the existing Node 20 CI and Node 18 backend image without making a runtime change absent authorization.
