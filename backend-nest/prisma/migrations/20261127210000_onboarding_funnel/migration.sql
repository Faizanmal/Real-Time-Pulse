CREATE TYPE "OnboardingFunnelStage" AS ENUM (
  'REGISTERED',
  'CONNECTED',
  'FIRST_VALID_SYNC',
  'FIRST_PUBLISH',
  'FIRST_CLIENT_VIEW',
  'FIRST_DECISION',
  'PAID_CONVERSION'
);

CREATE TABLE "onboarding_funnel_events" (
  "id" TEXT NOT NULL,
  "journeyKey" VARCHAR(64) NOT NULL,
  "eventKey" VARCHAR(64) NOT NULL,
  "stage" "OnboardingFunnelStage" NOT NULL,
  "happenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "onboarding_funnel_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "onboarding_funnel_events_eventKey_key"
  ON "onboarding_funnel_events"("eventKey");
CREATE UNIQUE INDEX "onboarding_funnel_events_journeyKey_stage_key"
  ON "onboarding_funnel_events"("journeyKey", "stage");
CREATE INDEX "onboarding_funnel_events_stage_happenedAt_idx"
  ON "onboarding_funnel_events"("stage", "happenedAt");
