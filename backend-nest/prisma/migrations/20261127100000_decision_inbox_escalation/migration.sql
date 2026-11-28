CREATE TYPE "ClientDecisionStatus" AS ENUM (
  'OPEN',
  'APPROVED',
  'DECLINED',
  'CHANGES_REQUESTED',
  'WITHDRAWN'
);

CREATE TYPE "ClientDecisionResponseKind" AS ENUM (
  'APPROVE',
  'DECLINE',
  'REQUEST_CHANGES'
);

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DECISION_REMINDER';

ALTER TABLE "share_links"
ADD COLUMN "allowDecisions" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "client_decisions" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "portalId" TEXT NOT NULL,
  "sourceShareLinkId" TEXT NOT NULL,
  "clientUserId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "prompt" VARCHAR(4000) NOT NULL,
  "portalRevision" INTEGER NOT NULL,
  "snapshotDigest" VARCHAR(64) NOT NULL,
  "status" "ClientDecisionStatus" NOT NULL DEFAULT 'OPEN',
  "dueAt" TIMESTAMP(3),
  "reminderCount" INTEGER NOT NULL DEFAULT 0,
  "lastReminderAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_decisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_decision_responses" (
  "id" TEXT NOT NULL,
  "decisionId" TEXT NOT NULL,
  "responderUserId" TEXT NOT NULL,
  "response" "ClientDecisionResponseKind" NOT NULL,
  "comment" VARCHAR(2000),
  "portalRevision" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_decision_responses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "decision_timeline_events" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "decisionId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "resourceType" VARCHAR(40) NOT NULL DEFAULT 'CLIENT_DECISION',
  "resourceId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "eventType" VARCHAR(40) NOT NULL,
  "actorType" VARCHAR(20) NOT NULL,
  "actorId" TEXT,
  "details" JSONB,
  "serverTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "decision_timeline_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "decision_escalation_policies" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "notificationOptIn" BOOLEAN NOT NULL DEFAULT false,
  "timeZone" VARCHAR(80) NOT NULL DEFAULT 'UTC',
  "businessDays" INTEGER[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5],
  "businessHoursStart" VARCHAR(5) NOT NULL DEFAULT '09:00',
  "businessHoursEnd" VARCHAR(5) NOT NULL DEFAULT '17:00',
  "reminderIntervalMinutes" INTEGER NOT NULL DEFAULT 1440,
  "maxReminders" INTEGER NOT NULL DEFAULT 3,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "decision_escalation_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "decision_reminders" (
  "id" TEXT NOT NULL,
  "decisionId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "decision_reminders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_decision_responses_decisionId_key"
ON "client_decision_responses"("decisionId");
CREATE UNIQUE INDEX "decision_escalation_policies_workspaceId_key"
ON "decision_escalation_policies"("workspaceId");
CREATE UNIQUE INDEX "decision_reminders_decisionId_ordinal_key"
ON "decision_reminders"("decisionId", "ordinal");
CREATE INDEX "client_decisions_workspaceId_status_dueAt_idx"
ON "client_decisions"("workspaceId", "status", "dueAt");
CREATE INDEX "client_decisions_portalId_createdAt_idx"
ON "client_decisions"("portalId", "createdAt");
CREATE INDEX "client_decisions_sourceShareLinkId_clientUserId_status_idx"
ON "client_decisions"("sourceShareLinkId", "clientUserId", "status");
CREATE UNIQUE INDEX "decision_timeline_events_eventId_key"
ON "decision_timeline_events"("eventId");
CREATE INDEX "decision_timeline_events_decisionId_serverTimestamp_idx"
ON "decision_timeline_events"("decisionId", "serverTimestamp");
CREATE INDEX "decision_timeline_events_workspaceId_resourceType_resourceId_idx"
ON "decision_timeline_events"("workspaceId", "resourceType", "resourceId");
CREATE INDEX "decision_reminders_createdAt_idx"
ON "decision_reminders"("createdAt");

ALTER TABLE "client_decisions"
ADD CONSTRAINT "client_decisions_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_decisions"
ADD CONSTRAINT "client_decisions_portalId_fkey"
FOREIGN KEY ("portalId") REFERENCES "portals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_decision_responses"
ADD CONSTRAINT "client_decision_responses_decisionId_fkey"
FOREIGN KEY ("decisionId") REFERENCES "client_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "decision_timeline_events"
ADD CONSTRAINT "decision_timeline_events_decisionId_fkey"
FOREIGN KEY ("decisionId") REFERENCES "client_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "decision_escalation_policies"
ADD CONSTRAINT "decision_escalation_policies_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "decision_reminders"
ADD CONSTRAINT "decision_reminders_decisionId_fkey"
FOREIGN KEY ("decisionId") REFERENCES "client_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
