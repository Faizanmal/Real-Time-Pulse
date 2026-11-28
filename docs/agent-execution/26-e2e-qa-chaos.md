# Phase 26 — Layered E2E QA and chaos

**Status: BLOCKED for end-to-end acceptance.** A layered GitHub Actions workflow, a focused security/tenant unit command, and three deterministic Playwright fault/load cases are implemented. Workflow YAML, typechecks, Playwright discovery, and the focused backend suite pass locally. Full backend lint/unit checks currently fail on repository-wide issues, and browser/database CI stages could not be exercised here because Docker Desktop denies the test runner's Docker pipe. No CI run on GitHub has been observed; no completion claim is made.

## Existing state and evidence

- `.github/workflows/ci-cd.yml:17-68` runs backend lint/typecheck and all Jest tests in separate jobs. Its E2E job at `:80-142` starts services named `realtimepulse_test`, passes `DATABASE_URL` directly and runs `npm run test:e2e`; that script points at `./test/jest-e2e.json` (`backend-nest/package.json:35`), which is absent in this checkout. It is not the Playwright journey.
- `.github/workflows/local-smoke.yml` previously ran a single, independent browser job. It installed backend/frontend/E2E dependencies and Chromium, then ran `npm run test:smoke` and uploaded its report.
- `e2e/playwright.smoke.config.ts:7-59` serializes browser flows, disables retries and traces for authenticated smoke, starts API/frontend, and uses loopback-only disposable Postgres/Redis. The API starter (`backend-nest/scripts/start-smoke-api.cjs:13-18,78-87`) rejects non-loopback or non-`pulse_test` DB URLs and tears down Compose after startup failure.
- `backend-nest/scripts/test-db-runner.cjs:12-35,59-74` separately validates the loopback `pulse_test` URL, applies migrations, seeds fictional fixtures and runs four DB integration specs. `backend-nest/docker-compose.test.yml:3-30` has no named volume and binds published ports to loopback.
- `backend-nest/prisma/seed-test-fixtures.ts:6-21,23-102` refuses `DATABASE_URL` as a fixture source and creates Northstar/Juniper demo tenants plus a private foreign-tenant portal. These IDs and `.invalid` emails are synthetic.
- Existing Playwright smoke (`e2e/tests/smoke.spec.ts`) covers cookie-only login, two workspaces and foreign connector/portal denial (`:84-350,1021-1048`), stale/revoked decision handling (`:1137-1360`), report download permission (`:1367-1475`), invalid-link UI (`:1477-1487`), dashboard blocker resolution (`:1489-1540`), value-ledger and product-analytics contracts (`:1542-1710`). It captures structured/redacted API errors and test steps; auth traces remain disabled to avoid storing cookies.

## Scoped plan and design / ADR

1. Reuse the existing smoke and test DB runners; don't add another API, schema, fixture database module, or provider integration.
2. Order CI as static/typecheck/focused unit → disposable DB integration → browser smoke. A failure in an earlier layer prevents later PR stages.
3. Add deterministic browser-only faults for the client portal: 503 followed by a delayed successful retry, and twelve parallel isolated portal views mixing six 200s with six 429s. Use fictional payloads and assert what clients see.
4. Add a local-only read burst against `/api/v1/health/live`: 100 requests in PR smoke and 1,000 in the scheduled/manual nightly lane. This endpoint is read-only; allow only 200/429/503, require at least one 200 and a p95 below 10 seconds. Record response counts and p95 in an attached JSON metric. It does not assert capacity for other endpoints or database writes.
5. Keep screenshots/HTML/JSON for failures. Authenticated smoke retains trace-off due cookie sensitivity; unauthenticated chaos runs retain Playwright traces on failure.

This changes CI/test tooling only. Product schema, service, API and UI contracts remain unchanged; no production settings/deployment workflow changed.

## Modified files

- `.github/workflows/local-smoke.yml` — layered static/unit, DB integration and smoke jobs; schedule/manual nightly fault/load job; read-only GitHub permission; fictional local DB vars; diagnostic artifacts.
- `backend-nest/package.json` — adds `test:ci:security-tenant` for the regression suites gating layered CI.
- `e2e/package.json` — adds `test:chaos`.
- `e2e/playwright.smoke.config.ts` — includes chaos specs in regular smoke. Auth traces remain off.
- `e2e/playwright.chaos.config.ts` — reuses the smoke server/fixture setup and retains failure traces for unauthenticated synthetic tests.
- `e2e/tests/chaos.spec.ts` — 503 recovery, mixed 200/429 parallel views, and bounded health-read burst with outcome metrics.
- `docs/agent-execution/26-e2e-qa-chaos.md` — this record.

## Migration notes

No Prisma schema, production data, migration, backfill or API changes. CI's database service and smoke Compose stack are ephemeral. Do not point `TEST_DATABASE_URL` at a shared or production database: both test runners enforce loopback and the exact `pulse_test` database name. Integration test job uses the same guard, even though its PostgreSQL service is provisioned separately by GitHub Actions.

## API and UI/test contracts

- Production API and UI contracts: unchanged.
- Fault tests stub `GET /api/v1/portals/share/{fictional-token}/view` only inside the Playwright browser context. The error fixture returns 503; the retry fixture returns a synthetic published portal with empty metrics. Expected UI: “Client portal unavailable”, alert text and Retry; then loading status, fictional portal heading and explicit empty-KPI message.
- Parallel fixture test returns deterministic 200s or 429s per fictional share token. Expected UI: each success page shows only its own fixture heading; each limited page shows the unavailable alert. Outcome attachment includes fixture labels/status/delay, and asserts six 200 plus six 429.
- Local burst calls read-only `GET /api/v1/health/live`; there is no auth token, provider key, data write or external URL. Expected outcome is bounded 200/429/503 responses and p95 under 10 seconds; failure reports include Playwright test title, step, screenshot and (nightly chaos only) trace.

## Test fixture/assertion/outcome/failure-trace index

| Test | Fixture and assertion | Expected visible result | Failure evidence |
|---|---|---|---|
| Existing agency/client smoke | `Northstar Demo Studio`, `Juniper Metrics Lab`; cookie session, connector/portal IDs, duplicate request and foreign-workspace ID | Agency dashboard and client portal work; foreign ID is denied; replay/duplicate is rejected or idempotent as asserted | Playwright named step, redacted response JSON, HTML report and failure screenshot; no auth trace/cookies |
| Existing decision inbox | Synthetic client decision versions, then stale and revoked state | Current decision can be recorded once; stale UI displays changed-state warning and no approve action | Playwright assertion/title, report and screenshot |
| Existing report parity | Fictional report and revision across portal/email/CSV/PDF; client requests agency-only CSV | Client sees matching approved report; unauthorized download returns 403 | Playwright assertion and HTML/JSON report |
| Existing invalid share | `not-a-valid-share-token` | “Client portal unavailable” plus alert, not sample success | Playwright assertion and screenshot |
| Existing command center | Fictional BLOCKED status and pending decision | Dashboard attention item clears after save | Playwright assertion and report |
| Chaos outage/retry | Synthetic endpoint 503 then gated 200 | Recoverable error → Retry → loading → fictional portal and empty KPI copy | Step-specific assertion, screenshot, JSON attempt/status/duration; nightly trace |
| Chaos parallel views | 12 fake tokens, 6 synthetic 200 and 6 synthetic 429 | Success pages show only their matching fixture; limited pages show unavailable alert | JSON statuses/delays/counts/p95, assertion, screenshot and nightly trace |
| Chaos API load | 100 PR / 1,000 nightly read-only loopback health requests | Only 200/503, at least one 200, p95 <10 s | JSON count/success/degraded/p95, Playwright assertion, screenshot and nightly trace |

## Checks and actual results

| Command/check | Exit | Result |
|---|---:|---|
| Backend `npm run typecheck` | **0** | TypeScript passed. |
| Frontend `npm run typecheck` | **0** | TypeScript passed. |
| `npm run test:ci:security-tenant` (`backend-nest`) | **0** | 6 suites, 36 tests passed. |
| `npm run prisma:validate` (`backend-nest`) | **0** | Prisma schema validation passed; phase adds no schema changes. |
| `npm run test:chaos -- --list` (`e2e`) | **0** | Three chaos tests discovered; no browser/server assertions executed. |
| `npx tsc --noEmit --target ES2022 --module commonjs --moduleResolution node --esModuleInterop --types node --skipLibCheck tests/chaos.spec.ts` (`e2e`) | **0** | Chaos test TypeScript passed. |
| Python YAML parse + CI dependency-order assertions | **0** | `static-unit → db-integration → smoke-e2e → nightly-chaos` parsed and asserted. |
| `npm run test:ci` (`backend-nest`) | **1** | 8 suites failed, 4 skipped, 53 passed; 31 tests failed, 5 skipped, 241 passed. Failures include pre-existing Stripe/mock and EventEmitter test setup, ESM interop suites, and socket `EACCES` for HTTP controller specs on this runner. |
| `npm run lint` (`backend-nest`) | **1** | 2,500 errors and 244 warnings in the existing broad source tree (formatting/import/type-safety findings). The layered gate uses typecheck and the focused tenant/security suite; full lint remains a repository cleanup item and is still configured in legacy `ci-cd.yml`. |
| `npm run test:chaos` (`e2e`) | **1 before tests** | Playwright webServer could not access Docker Desktop `npipe:////./pipe/dockerDesktopLinuxEngine`; zero chaos assertions ran. |
| Disposable DB integration / GitHub-hosted layered workflow | **NOT RUN** | Local Docker restriction; no remote GitHub Actions run was triggered from this workspace. |

## Manual smoke steps

1. On an owned Linux runner, run the GitHub workflow or locally install dependencies and Chromium, then run `cd backend-nest && npm run typecheck && npm run prisma:validate && npm run test:ci:security-tenant`.
2. Use only `TEST_DATABASE_URL=postgresql://pulse_test:pulse_test_only_password@127.0.0.1:55432/pulse_test?schema=public`; start `npm run test:db:up`, run `npm run test:integration`, then tear down with `npm run test:db:down`. Confirm both fictional workspace records and foreign portal fixture.
3. From `e2e`, run `npm run test:smoke`; confirm owner and client views, foreign tenant 403, stale/revoked state, recoverable invalid share and duplicate/idempotent outcomes. Inspect the redacted report; do not enable auth traces.
4. Run `CHAOS_REQUEST_COUNT=1000 npm run test:chaos` on the same disposable stack. Confirm 503→retry recovery, six 200/six 429 isolated outcomes, health-read count and p95, and retain the trace only for synthetic unauthenticated chaos cases.
5. Verify Compose teardown removes both test containers and no volume remains. Do not reuse a service database.

## Security and tenant review

- CI token permission is `contents: read`. All service values are synthetic; no provider keys or API credentials are required.
- DB runner/seed guards reject non-loopback and non-`pulse_test` URLs. Compose publishes only on 127.0.0.1, disables Redis persistence and declares no database volume.
- Two-persona smoke explicitly checks foreign workspace portal and connector IDs. Parallel UI test labels each fixture and confirms a successful response does not paint into another page. The new tests make no cross-tenant writes.
- No external target is contacted by chaos: page API routes are stubbed, and health burst targets only the local test API. The burst is read-only and capped at 1,000.
- Existing full backend lint/unit failures are recorded; do not treat a passing focused unit selection as full suite clearance. No product privilege logic was changed in this phase.

## Data privacy

Fixtures use Northstar/Juniper fictional names and `.invalid` identities; tokens use `fixture-*`. The chaos request has no tenant/customer payload. Auth traces remain disabled; nightly traces are restricted to unauthenticated synthetic tests. Artifacts are retained seven days in CI and may contain fictional IDs and synthetic response data only.

## Rollback

Revert the listed workflow, package scripts, Playwright config and chaos test additions. No schema, stored customer state or production configuration needs rollback. The workflow does not deploy or publish an image. If any runner unexpectedly resolves a non-loopback DB URL, stop: the safety guards must not be weakened to make CI pass.

## Unverified assumptions and status

- This local runner cannot access Docker Desktop's pipe, so no database-backed Playwright assertions or GitHub-hosted job result has been observed.
- The broad backend lint/full Jest baseline is currently failing; the new layered workflow gates the focused regression suite, not all legacy suites. Resolve the listed failures and fold broader test/lint coverage back into the gate before treating CI as fully green.
- The 1,000-request test is a bounded, read-only synthetic load probe of liveness only. It does not establish tenant write consistency, sustained throughput, deployment capacity or overload safety on mutating endpoints.
- No production data/credentials, migrations, provider services, unrelated tenants or live abuse traffic were used.
- **Final result: BLOCKED.** Workflow and test code are prepared, but E2E/DB/nightly execution and full lint/unit clearance are unverified or failing.

## Exactly what should happen before the next phase

Run this workflow on an owned GitHub/Linux runner and preserve the run URL plus reports. Confirm DB integration and the tenant-denial Playwright assertions pass on fresh ephemeral services. Fix the full-suite failures and lint backlog in their owning phases, then make broad lint/unit gates green. Review the nightly 1,000-request p95/status distribution and keep it on the disposable local API only. Do not mark Phase 26 PASS until these run results exist.
