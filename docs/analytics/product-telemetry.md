# Product telemetry contract

This contract feeds the workspace-scoped dashboard at `/dashboard/analytics`. The raw event ledger is additive and separate from billing `UsageRecord`; recording these events never creates Stripe usage or a billable side effect.

## Event kinds

| `kind` | Purpose | Required fields |
| --- | --- | --- |
| `FEATURE_ADOPTION` | A feature was opened or first used | `featureKey`, `eventName` |
| `FEATURE_SUCCESS` | A feature action completed | `featureKey`, `eventName` |
| `FEATURE_GUARDRAIL` | A failure, conflict, or safety constraint occurred | `featureKey`, `eventName` |
| `COST` | Measured usage, optionally with an observed/estimated cost | `featureKey`, `eventName`, `costCategory`, `value`, `unit` |
| `EXPERIMENT` | A numeric experiment outcome for one variant | `featureKey`, `eventName` (metric), `value`, `experimentKey`, `variantKey` |

`eventId` must be a random UUID v4. It is unique within a workspace; replaying the same ID is acknowledged as a duplicate and does not add another event. The authenticated workspace supplies tenant scope. Do not send a `workspaceId` in the payload.

Cost categories are `PROVIDER_CALL`, `JOB_RUNTIME`, `EMAIL`, `STORAGE`, and `AI_TOKENS`. `value` and `unit` record measured quantity (`calls`, `seconds`, `bytes`, `emails`, `tokens`, and related documented units). A cost amount is optional when no trustworthy rate is available. If supplied, `costMicros` is a nonnegative integer in millionths of `currency`; include `costBasis: OBSERVED` only for a measured bill/charge, or `ESTIMATED` when computed from an identified rate. The UI never turns a missing amount into zero.

All feature and experiment events require current workspace analytics consent. Revoking consent deletes those event kinds. Operational cost/usage events contain workspace scope and aggregate resource quantities only, and remain for internal accounting. Do not include names, email addresses, user IDs, portal/client IDs, IP addresses, prompts, provider payloads, arbitrary JSON or secret values. The API validates slug fields and UUID event IDs and rejects arbitrary payload fields under the application's global validation pipe.

## API

- `POST /api/v1/analytics/product-events`: authenticated agency role, CSRF protected. `201` response is `{ accepted, duplicate }`; feature/experiment events without active consent return `{ accepted: false, duplicate: false, reason: "consent_required" }`.
- `GET /api/v1/analytics/product-analytics?days=30`: authenticated agency role, workspace scoped; `days` must be an integer from 1 to 90. Returns aggregate feature usage/costs and experiment sample count, total and mean, with `since`, `generatedAt` and `lastEventAt`.
- `GET /api/v1/analytics/product-analytics/experiments.csv?days=30`: authenticated agency role; exports aggregated results only, with no raw event identifiers.

The event table does not automatically infer provider prices. Producers must report their own stable event ID, measured quantity, and source-backed cost amount or an explicitly marked estimate. Until a producer supplies a cost amount, the dashboard shows usage with cost unavailable.
