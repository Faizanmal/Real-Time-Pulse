CREATE TYPE "ShareAccessRequestStatus" AS ENUM ('PENDING', 'REVIEWED');

CREATE TABLE "shared_portal_comments" (
    "id" TEXT NOT NULL,
    "shareLinkId" TEXT NOT NULL,
    "displayName" VARCHAR(80) NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shared_portal_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "share_link_assignments" (
    "id" TEXT NOT NULL,
    "shareLinkId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "share_link_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "share_access_requests" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "shareLinkId" TEXT,
    "email" VARCHAR(254) NOT NULL,
    "message" VARCHAR(1000),
    "status" "ShareAccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    CONSTRAINT "share_access_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "shared_portal_comments_shareLinkId_createdAt_idx" ON "shared_portal_comments"("shareLinkId", "createdAt");
CREATE UNIQUE INDEX "share_link_assignments_shareLinkId_userId_key" ON "share_link_assignments"("shareLinkId", "userId");
CREATE INDEX "share_link_assignments_userId_idx" ON "share_link_assignments"("userId");
CREATE INDEX "share_access_requests_workspaceId_status_createdAt_idx" ON "share_access_requests"("workspaceId", "status", "createdAt");
CREATE INDEX "share_access_requests_shareLinkId_email_status_idx" ON "share_access_requests"("shareLinkId", "email", "status");

ALTER TABLE "shared_portal_comments" ADD CONSTRAINT "shared_portal_comments_shareLinkId_fkey" FOREIGN KEY ("shareLinkId") REFERENCES "share_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "share_link_assignments" ADD CONSTRAINT "share_link_assignments_shareLinkId_fkey" FOREIGN KEY ("shareLinkId") REFERENCES "share_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "share_link_assignments" ADD CONSTRAINT "share_link_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "share_access_requests" ADD CONSTRAINT "share_access_requests_shareLinkId_fkey" FOREIGN KEY ("shareLinkId") REFERENCES "share_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "share_access_requests" ADD CONSTRAINT "share_access_requests_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
