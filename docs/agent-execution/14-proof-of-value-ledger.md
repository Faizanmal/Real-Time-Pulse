# Phase 14 — Proof-of-value ledger

**Status: PASS (local implementation, disposable database and browser fixtures).** Value estimates now use a fixed, versioned formula with explicit low/base/high assumptions and evidence ownership/date. Draft and approved revisions are append-only through the API. Approved client-visible claims are included in the next portal publication and in a tenant-scoped packet export. No production database/settings were changed and no provider keys were required.

## Existing state and evidence inventory

- The root `AGENTS.md` and a `reference/` pack directory are absent in this checkout; the available `frontend/AGENTS.md`, `docs/architecture/current-system.md`, and Phase 09/12 execution reports were read. No reference-pack files were found under the repository.
- Phase 09 already added canonical `MetricDefinition`, immutable `MetricSourceObservation`, `MetricNormalizedObservation`, portal-scoped `MetricMapping`, immutable `MetricSnapshot` plus source links, milestones, and reprocess runs in `backend-nest/prisma/schema.prisma:379–578`.
- `MetricProvenanceService` already owns the analytics contract and mapping workflow (`backend-nest/src/analytics/metric-provenance.service.ts`), including fixed transforms, missing values, feed health and client-safe metrics. Its `publicMetrics(portalId)` filters `clientVisible` and allows source IDs only behind `allowSourceDrilldown` (`:385–455`).
- Portal publication already creates a versioned `PublishedPortalSnapshot` (`backend-nest/src/portals/portal-snapshot.ts:18–105`); `PortalService.publishDraft` captures client-visible metrics before the transactionally guarded publish (`backend-nest/src/portals/portal.service.ts:270–310`).
- Both public portal and capability-share paths already returned portal-scoped canonical metrics (`backend-nest/src/portals/portal.service.ts:510–555`, `backend-nest/src/share-links/share-links.service.ts:480–520,667–710`).
- Existing export routes were workspace scoped but exported portal/widget metadata, not client value claims (`backend-nest/src/exports/export.controller.ts`, `export.service.ts`).
- No value formula, sensitivity record, approved claim history, or provenance-rich value packet existed. No generative ROI feature was present or reused.

## Scoped plan and design / ADR

Reused the current Analytics module and `MetricProvenanceService` boundary; no second analytics module was introduced. Added a `ValueLedgerEntry` model and a fixed formula service. Added owner/admin APIs for draft, approve and list; added an export endpoint; included only approved client-visible claims in the next published snapshot and capability-share response; added an agency UI and client-safe display; tested formula, role, tenant, stale/replay, revocation and export behavior.

### ADR — value claim is a versioned scenario, not an ROI assertion

1. The only supported calculation is `time_saved_cost@1.0.0`: `hoursSaved × loadedHourlyRate`, in USD. There is no user expression, dynamic formula, ROI percentage, attribution field, or silent zero-fill.
2. Both inputs require ordered `low <= base <= high` values and evidence. Human notes and source references are labeled; the server records the authenticated owner label and timestamp. Sensitive-looking credentials/contact identifiers and URL references are rejected.
3. Sensitivity output is low/base/high scenario arithmetic, not a statistical confidence interval. The client view and export explicitly say this does not establish causal attribution or guaranteed savings.
4. Every draft requires `expectedRevision`. New claims create a new unique `(portalId, revision)` row. There is no edit/delete API. Approval changes only DRAFT status, sharing choice and approver metadata; an approved claim cannot be edited or unshared in place. A correction or baseline change requires a new revision.
5. Only owner/admin roles may manage claims. Tenant membership/role is re-read from the database; portal reads and exports include exact workspace and non-deleted predicates. Client output filters approved and explicitly client-visible claims and serializes an explicit allowlist that omits internal actor and workspace IDs.
6. The published packet is a snapshot. New approval appears to clients after the next explicit publish; it does not rewrite an already published report. Capability share links receive the same snapshot claim field only after their existing password/expiry/revocation/assignment checks.

## Modified files

- `backend-nest/prisma/schema.prisma` — `ValueLedgerStatus`, `ValueLedgerEntry`, workspace/portal relations.
- `backend-nest/prisma/migrations/20261126141009_proof_of_value_ledger/migration.sql` — additive table, enum, indexes and FKs. Prisma initially proposed unrelated index drops due pre-existing schema drift; those drops were removed before applying this migration.
- `backend-nest/src/analytics/value-ledger.service.ts` — role/tenant checks, fixed formula, assumption/evidence validation, sensitivity calculation, immutable revisions, approval and client allowlist.
- `backend-nest/src/analytics/value-ledger.service.spec.ts` and `value-ledger.integration.spec.ts` — formula, validation, permission, stale/replay, sensitivity, tenant and real database coverage.
- `backend-nest/src/analytics/analytics.controller.ts`, `analytics.module.ts` — authenticated list/create/approve endpoints and service wiring.
- `backend-nest/src/portals/portal-snapshot.ts`, `portal.service.ts`, `portals/dto/portal.dto.ts` — additive optional `valueClaims` snapshot field and publication/client-view assembly.
- `backend-nest/src/share-links/share-links.service.ts`, `share-links.service.security.spec.ts` — permitted claim propagation after existing capability checks; revoked access does not query or return claims.
- `backend-nest/src/exports/export.service.ts`, `export.controller.ts`, `export.module.ts`, `value-ledger-export.spec.ts` — scoped JSON client packet; direct file response bypasses the standard JSON response wrapper and uses `no-store`/`nosniff`.
- `backend-nest/scripts/test-db-runner.cjs` — includes the value-ledger DB integration suite.
- `frontend/src/lib/api/client.ts` — sends the established HttpOnly session cookie and CSRF header for unsafe same-site API requests while retaining bearer support.
- `frontend/src/lib/api/analytics.ts`, `frontend/src/types/index.ts` — ledger API and client packet contracts.
- `frontend/src/components/analytics/ValueLedgerManager.tsx`, `frontend/src/app/dashboard/analytics/page.tsx` — draft, sensitivity, evidence, revision, approval/share and export UI with loading/empty/error/retry states. Also removed the unrelated random fallback peak-hour data and added an empty state so fabricated chart values are not displayed.
- `frontend/src/components/client-portal/ValueClaims.tsx`, `frontend/src/app/v/[shareToken]/page.tsx`, `frontend/src/app/share/[token]/page.tsx` — client-safe formula, period, sensitivity, assumptions, evidence owner/date and limitation display.
- `e2e/tests/smoke.spec.ts` — full UI-to-client/export journey plus member 403 checks for ledger reads/writes/exports.
- `docs/agent-execution/14-proof-of-value-ledger.md` — this report.

## Migration and compatibility notes

Migration `20261126141009_proof_of_value_ledger` adds one enum and one table with workspace/portal cascade FKs and lookup/unique indexes. It does not rewrite existing metric data. The schema field `valueClaims` is optional/additive in published snapshots and API responses; old snapshots without it continue to use the existing legacy fallback. The current portal API soft-deletes portals; a hard delete or workspace deletion follows the existing cascade policy and removes that tenant’s ledger rows.

The migration was generated and applied only to loopback `pulse_test` using fictional fixtures. No production migration was run. Rollback is application-first: disable the UI/routes/snapshot additions and keep the additive table and claim rows for recovery. Do not drop the ledger table in a rollback. Old app code ignores the optional snapshot field. Re-publish explicitly if a client needs to see a later approved claim.

## API and UI contracts

- `GET /api/v1/analytics/value-ledger?portalId=...` — JWT + agency role; service requires a current OWNER/ADMIN and a non-deleted portal in the user’s workspace. Returns all revisions newest first for the agency view.
- `POST /api/v1/analytics/value-ledger` — JWT + agency role + current DB OWNER/ADMIN. Body: `{ portalId, expectedRevision, title, periodStart, periodEnd, timeZone, hoursSaved:{ low, base, high, evidence }, loadedHourlyRate:{ low, base, high, evidence } }`. Each evidence item is either `{ kind:"HUMAN_NOTE", label, note }` or `{ kind:"SOURCE_REFERENCE", label, reference }`. Formula is fixed server-side; units are hours, USD/hour, and USD. Stale `expectedRevision` returns conflict; duplicate retries do not add a second revision.
- `POST /api/v1/analytics/value-ledger/:id/approve` — `{ expectedRevision, clientVisible }`. Only latest DRAFT can be approved. Repeating the same approval is idempotent; attempting to alter an approved share flag conflicts.
- `GET /api/v1/exports/portal/:id/value-ledger.json` — agency-authenticated, exact-workspace and non-deleted portal. Returns `{ packetVersion, portal, exportedAt, claims, calculationNotes }`; claims contain formula/version, calculation, value/unit, period/time zone, sensitivity, assumptions/evidence owner/date, approval owner/date and limitation.
- `valueClaims` is an optional field on `/portals/share/:shareToken/view`, authenticated draft preview and authorized capability-share response. Public/capability views include only approved, client-visible rows. The new publish snapshot stores that list. Existing portal and share URLs are unchanged.
- `/dashboard/analytics` contains the ledger UI. Drafts remain agency-only. The user checks a separate “include in next published client packet” option when approving. Client routes display only approved claims carried by the published snapshot or authorized share flow.
- The API client uses `credentials: include`, adds `X-CSRF-Token: browser-session` on unsafe requests, and preserves bearer header support. The backend continues to enforce allowed Origin and session CSRF.

## Tests and actual command outcomes

All fixture data is fictional and `.invalid`/`.test`; tests use the disposable local `pulse_test` database. Live provider or billing keys are not needed.

| Command | Actual result |
|---|---|
| `node ./scripts/prisma-runner.cjs generate` (`backend-nest`) | exit 0 — Prisma Client generated |
| `node ./scripts/prisma-runner.cjs validate` (`backend-nest`) | exit 0 — schema valid |
| `npm run typecheck -- --pretty false` (`backend-nest`) | exit 0 |
| `npm run typecheck -- --pretty false` (`frontend`) | exit 0 |
| `npm test -- --runInBand src/analytics/value-ledger.service.spec.ts src/exports/value-ledger-export.spec.ts src/share-links/share-links.service.security.spec.ts src/portals/portal.service.publish.spec.ts src/analytics/metric-provenance.service.spec.ts` (`backend-nest`) | exit 0 — 5 suites / 34 tests passed |
| `node ./scripts/test-db-runner.cjs migrate` (`backend-nest`, `TEST_DATABASE_URL` constrained to loopback `pulse_test`) | exit 0 — additive migration applied |
| `node ./scripts/test-db-runner.cjs integration` (`backend-nest`, same disposable DB) | exit 0 — 3 suites / 4 tests passed; includes append-only revision/tenant DB contract and existing metric integration |
| `npm run test:smoke -- --grep "value ledger claim"` (`e2e`) | exit 0 — 1 browser test passed; UI draft → approval → public client view → packet export |
| `npm run test:smoke -- --grep "agency creates persistent client portal"` (`e2e`) | exit 0 — 1 browser test passed; includes client role 403 assertions for ledger list/create and value packet export |
| `npx eslint` on the new backend service/specs and modified analytics/export controller/service files | exit 0 — zero errors |
| `npx eslint` on touched frontend ledger, client, API and type files | exit 0 — 0 errors, 14 warnings (large existing pages/components and effect-state lint warnings) |
| Frontend Prettier via installed local binary with `--no-config` on touched TSX/API/type files | exit 0 |
| `git diff --check` | exit 0 — line-ending warnings only |

The targeted ESLint commands were run against the explicit backend analytics/export files listed above and the frontend `ValueLedgerManager`, `ValueClaims`, analytics API/client, analytics page, public/share portal pages and shared types. The frontend report includes existing size/effect warnings; no errors remained in this targeted set.

The first browser attempt exited 1 because `StreamableFile` passed through the global JSON response interceptor and returned no packet claims. The export route was changed to send the file directly; the final browser run exited 0. An initial sandbox Docker invocation also exited 1 with Docker pipe permission denied; the authorized run against disposable containers passed. Browser teardown emits Redis connection-close noise after Playwright has passed and removed the containers.

## Manual smoke steps

1. Start the local test app with fictional fixture data and sign in as the fictional workspace owner.
2. Open Dashboard → Analytics → Proof-of-value ledger; choose a portal, enter a period, low/base/high hours and rate, and a human evidence note for each.
3. Save the draft. Verify the displayed base value equals hours × rate and the sensitivity range uses low×low and high×high. Verify owner and entered date appear in agency revision history.
4. Check “include in next published client packet”, approve the draft and publish the portal. Open the client portal and verify formula/version, period/time zone, evidence owner/date, range, and limitation.
5. Export the client value packet JSON. Verify the packet has approved client-visible claims, calculation notes and no internal actor IDs, credentials, or private workspace fields.
6. Add a later baseline as a new revision with the latest expected revision. Verify the approved earlier revision remains in history and stale writes return conflict.
7. Sign in as the client fixture and confirm ledger list/write/export endpoints return 403. Revoke or expire a capability link and confirm it does not return claim data.

## Security, tenant and data privacy review

- Owner/admin checks use current database workspace role; a stale JWT role is insufficient. Portal list/create/export requires `workspaceId` and `deletedAt:null`; foreign IDs return not found. Ledger entry approval scopes both entry and workspace and verifies current latest revision.
- Capability-share service validates its existing token, active state, password, expiry, assignment, and deleted portal before calling the claims reader. Regression test asserts revoked portal access does not call the ledger reader. Public queries require `status=APPROVED`, `clientVisible=true`, and a live portal.
- Client serialization omits `workspaceId`, `createdById`, `approvedById`, email, credentials, and raw database rows. Explicit evidence is intentionally client-visible only when an owner/admin approves with sharing enabled; user-provided evidence notes are therefore displayed/exported. Obvious credential/contact patterns and URL source references are rejected, but human review remains necessary for sensitive business context.
- Audit events record claim creation and approval with actor, revision and visibility metadata, not assumption notes. The existing `AuditService` is best-effort and can swallow database write failure; durable audit storage during an audit DB outage is not guaranteed.
- Test fixture values and names are fictional. No live provider or payment system was contacted. The value calculation has no provider dependency.

## Rollback

Disable/revert the Phase 14 UI, endpoints and snapshot field, leaving the additive table and approved revision history intact. Do not drop the migration in rollback. Older application versions ignore `valueClaims`. If a client-facing claim needs correction, create a higher revision, approve it, and explicitly publish again; preserve the earlier approved revision for traceability.

## Unverified assumptions and limits

- The sole formula is an estimate and depends on customer/agency-entered time saved and loaded rate assumptions. The rate currency is currently USD; other currencies or formulas require explicit versioned additions and tests.
- UI period input currently uses UTC. The API stores and returns an IANA time zone, but no local-time conversion UI was implemented.
- Free-text source references are non-clickable identifiers. No external source system is dereferenced or verified live.
- AuditService persistence is best-effort as noted above.
- Root `AGENTS.md` and reference pack were absent from this repository clone; the report used available architecture and prior phase documentation.
- No production deployment or provider-key verification was performed or needed.

## Before the next phase

Have product/finance owners approve the fixed formula semantics, USD-only currency policy, and which client-entered assumptions may be shared. Review the hard-delete cascade/retention policy for value history. Then proceed to Phase 15 with any new formulas added as separately versioned deterministic contracts; do not add arbitrary ROI or attribution fields.

## Final verification note

The broader agency/client smoke finished with exit 0 and one passed test. Targeted frontend ESLint finished with exit 0, 0 errors and 14 warnings; `git diff --check` exited 0. Browser teardown printed expected Redis connection-close noise while its disposable containers were being removed; Playwright remained exit 0.
