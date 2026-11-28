# Phase 21 — Stripe commercial truth

**Status: BLOCKED** — server-side plan enforcement, Stripe event reconciliation, pricing alignment, and authenticated data export/deletion requests are implemented and verified locally. Final account deletion fulfillment is not safely wired, so the account-deletion acceptance criterion is not complete. No live Stripe account, key, or production setting was used.

## Existing state and evidence

- The repository already had a Prisma `Subscription` model and `SubscriptionPlan` enum (`backend-nest/prisma/schema.prisma:233-270`), a unique Stripe webhook event ID on `BillingEvent` (`:1883-1890`), and a local `Invoice` model (`:4229`). Billing controller/service already exposed checkout, portal, cancellation, plan changes, invoices, limits, and webhook handling.
- `BillingService` had its own plan prices and limits, while `PLAN_PRICING` in `src/billing/dto/billing.dto.ts` contained different Pro price and seat/portal limits. Pricing pages also had stale defaults and the legacy `/billing` page called nonexistent same-origin endpoints.
- Portal creation already checked subscription portal limits (`backend-nest/src/portals/portal.service.ts:633-645`), member invites checked seat limits, and the widget service had no plan check. AI endpoints did not meter requests server-side.
- Billing mutation routes already had an owner/admin role guard. GDPR services included broader export/deletion machinery, but authenticated self-service export/request endpoints were absent, the expanded GDPR service was not registered, and its export upload URL was a placeholder. The background deletion fulfillment was not wired to safely account for active billing and shared workspaces.

## Scoped plan and design decision

Audit existing billing, entitlement and GDPR paths first; use one canonical plan catalog; make the same catalog drive pricing and enforcement; enforce AI/widget/portal/member quotas at authenticated server boundaries; make Stripe webhooks idempotent and resistant to stale ordering; expose owner/admin billing reads and writes; provide an allow-listed account export and a delayed, cancellable deletion request. Preserve existing Stripe routes and use an additive migration.

ADR: `backend-nest/src/billing/plan-catalog.ts` is the single source for plan names, monthly prices and portal/user/widget/AI quotas. AI use is reserved atomically in a workspace/month meter before the protected operation executes. Stripe subscription events carry event IDs and event timestamps; existing unique `BillingEvent.stripeEventId` prevents duplicate processing and `Subscription.stripeStateUpdatedAt` prevents an older delivery from overwriting newer state. Live secret keys are rejected unless the explicit `STRIPE_LIVE_BILLING_ENABLED=true` gate is set. Self deletion remains a reviewable delayed request; final destructive erasure is not attempted by this phase.

Catalog values: Trial $0 / 5 portals / 1 user / 25 widgets / 100 AI requests per month; Pro $49 / 5 / 1 / 100 / 1,000; Agency $99 / 15 / 5 / 1,000 / 10,000. Prices are USD monthly. Checkout is advertised only when a Stripe key, matching price ID, and live-billing policy allow it.

## Modified files

- Persistence: `backend-nest/prisma/schema.prisma`; additive migration `backend-nest/prisma/migrations/20261127220000_stripe_commercial_truth/migration.sql`; `backend-nest/.env.example`.
- Billing source/contracts: `backend-nest/src/billing/plan-catalog.ts`, `billing.service.ts`, `billing.controller.ts`, `billing.module.ts`, `ai-usage-limit.guard.ts`, `dto/billing.dto.ts`; regression specs `commercial-truth.spec.ts` and `billing-role.guard.spec.ts`.
- Enforcement: `backend-nest/src/portals/portal.service.ts`, `widgets/widget.service.ts`, AI Insights and Advanced AI controllers/modules, `ai-insights/conversational-ai.controller.ts`, ML and ML Marketplace controllers/modules.
- Privacy: `backend-nest/src/gdpr/gdpr.controller.ts`, `gdpr.service.ts`, new `gdpr.self-service.spec.ts`.
- UI/API: `frontend/src/app/billing/page.tsx`, `dashboard/billing/page.tsx`, `dashboard/gdpr/page.tsx`, `components/dashboard/BillingDashboard.tsx`, `lib/api/billing.ts`, `lib/api/gdpr.ts`, `lib/api/index.ts`, `lib/enterprise-api.ts`.
- Widget regression coverage: `backend-nest/src/widgets/widget.entitlement.spec.ts`.

The worktree includes substantial changes from earlier phases. This list names Phase 21 touchpoints; unrelated existing changes were left intact.

## Schema, migration and rollback

The migration adds nullable `Subscription.stripeStateUpdatedAt`, a workspace relation to monthly `AIUsageMeter` rows, and a unique `(workspaceId, period)` constraint. It is additive; existing subscriptions remain valid and metering begins at zero on first request. Migration was applied successfully against the disposable Docker test database on `127.0.0.1:16434`, then the test containers were stopped and removed. No production database was touched.

Rollback: disable AI quota guard bindings and widget quota enforcement in a code rollback; leave the additive columns/table in place until a separately approved schema rollback. Do not drop usage records automatically. The `STRIPE_LIVE_BILLING_ENABLED` default is false and can gate live-key operation. Existing Stripe routes and payloads remain; `/billing/plans` is additive and plan/limit result shapes were aligned to current UI needs.

## API and UI contracts

- `GET /billing/plans`: canonical plan IDs/names/price/period/features/limits plus `checkoutAvailable`.
- Existing `GET /billing/subscription`, `/billing/limits`, `/billing/invoices`, checkout, portal, cancel and plan-change routes use the canonical catalog and current workspace. Billing reads and mutations require workspace owner/admin; member requests are denied. Checkout accepts plan and success/cancel URLs as before.
- Protected AI compute/generation routes reserve one monthly request for the authenticated workspace and return 403 after quota exhaustion. Portal, widget and invite creation enforce their catalog limits on the server.
- Stripe duplicate events are ignored via the existing unique event ID. Older subscription snapshots cannot roll back a newer entitlement state. Invoice history surfaces invoice dates/status/amount and Stripe PDF/hosted URLs where available.
- `GET /gdpr/self/export` returns an allow-listed current-user/workspace export. `GET/POST /gdpr/self/deletion-request` reads/creates a delayed request; `PATCH /gdpr/self/deletion-request/:requestId/cancel` cancels the caller's request. Cross-user request IDs return not found. A workspace owner cannot request deletion while other members remain. Requests are scheduled 30 days out and marked as requiring billing/tenant review.
- Billing UIs share catalog/limits, disable checkout when unavailable, show invoice links and AI request usage, and the legacy `/billing` entry now uses the canonical dashboard. GDPR page has export and deletion request/status/cancel states.

## Verification commands and actual results

- `cd backend-nest; npm run prisma:validate` — **exit 0**.
- `cd backend-nest; npx prisma generate` — **exit 0**.
- `cd backend-nest; npm run test:db:up` — first sandbox invocation **exit 1** from pipe permission; retry with authorized local Docker access **exit 0**.
- `cd backend-nest; npm run test:db:migrate` — sandbox invocation **exit 1** with schema-engine error; local Docker retry **exit 0**, all 26 migrations applied including this one.
- `cd backend-nest; npm run test:db:down` — **exit 0**, containers/network removed.
- `cd backend-nest; npm run typecheck -- --pretty false` — **exit 0**.
- `cd backend-nest; npm run build` — **exit 0**.
- `cd backend-nest; npm test -- --runInBand src/billing/commercial-truth.spec.ts src/billing/billing-role.guard.spec.ts src/gdpr/gdpr.self-service.spec.ts src/widgets/widget.entitlement.spec.ts src/portals/portal.service.spec.ts src/portals/portal.service.publish.spec.ts` — **exit 0**, 6 suites / 23 tests passed, including duplicate/reordered webhook behavior, live key disabled, billing role denial, export/deletion scoping, and quota checks.
- `cd frontend; npx tsc --noEmit` — **exit 0** after the final usage-row correction.
- `cd frontend; npx eslint src/app/billing/page.tsx src/app/dashboard/billing/page.tsx src/app/dashboard/gdpr/page.tsx src/components/dashboard/BillingDashboard.tsx src/lib/api/billing.ts src/lib/api/gdpr.ts src/lib/enterprise-api.ts src/lib/api/index.ts` — **exit 0**, 14 warnings and 0 errors.\n- `git diff --check` — **exit 0** after fixing trailing whitespace. Git prints line-ending normalization warnings for existing modified files.
- Backend ESLint on touched billing/privacy/AI files — **exit 1**, style/unsafe-any findings (32 issues, 14 errors) in touched large controller/spec files. This check is not clean and is not represented as passing.
- 

No Stripe credentials are configured. Mock/unit contracts and DB migration do not require provider keys. Live webhook delivery, Stripe invoice rendering and paid checkout remain unverified.

## Manual smoke steps

1. Start local services and the app with demo/test Stripe configuration (never a live key); sign in as owner, admin and member in separate sessions.
2. Open `/dashboard/billing` and `/billing`; confirm both show identical Trial/Pro/Agency plan names, prices and portal/user/widget/AI request limits. With no test Stripe price IDs configured, confirm paid checkout is disabled with a clear unavailable state.
3. As a member, call billing subscription/invoice/checkout endpoints directly and confirm 403. As owner/admin, inspect invoice empty/loading/error states and test invoice links with Stripe test fixtures.
4. Exercise an AI route below and at the monthly quota; confirm the final allowed call succeeds and the next returns 403. Try portal/widget/invite creation at each plan boundary.
5. Deliver the same Stripe test webhook twice, then deliver older subscription state after newer state; confirm one billing event/effect and that entitlements remain current.
6. From GDPR settings, export as the current user and inspect that credentials, share secrets and other users' records are absent. Submit, refresh, then cancel a delayed deletion request. Try another user's request ID and confirm it is not disclosed.

## Security, tenant and privacy review

Usage meters and resource limits are keyed by authenticated `workspaceId`; clients cannot choose a workspace in the meter guard. Billing controller retains workspace scoping and owner/admin checks for all financial reads/mutations. Webhook event uniqueness and timestamp watermark protect retries/reordering. Export is user scoped and field allow-listed. The deletion request refuses an owner when other workspace users remain and does not perform data erasure or billing cancellation. No raw provider credential is returned by export. UI disabled states are convenience only; enforcement is in backend guards/services.

## Unverified assumptions and limitations

- Product price/limit values are treated as the intended commercial terms because the repository contained conflicting values and no approved pricing document was found. Confirm these figures before enabling checkout.
- Live Stripe test/live account behavior, actual price IDs, portal configuration, invoice URLs and real webhook signature delivery are unavailable here.
- AI metering is per protected endpoint invocation, not model-token cost. Any AI entry point outside the guarded controller list needs audit before release.
- **Final account deletion is not implemented.** The scheduled request can be created/cancelled, but the existing destructive deletion worker is not registered and Stripe cancellation, shared-workspace transfer and retention policy are not resolved. This prevents claiming self-service account deletion complete.
- Billing API keeps existing endpoint paths but two frontend components previously expected inconsistent response envelopes; their adapters now normalize to the canonical API. Check external API clients before treating response-shape alignment as a public contract change.

## Before Phase 22

Complete and review a deletion fulfillment workflow that verifies authorization, cancels or transfers active billing, preserves co-tenant workspace ownership, honors retention obligations, audits the irreversible action, and provides export/confirmation. Approve canonical prices and limits, then validate checkout/webhooks/invoices with Stripe test fixtures and run backend lint cleanup. Until then, keep production billing gated and Phase 21 **BLOCKED**.
