ALTER TABLE "portals"
  ADD COLUMN "draftMode" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "publishedSnapshot" JSONB,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "publishRevision" INTEGER NOT NULL DEFAULT 0;
