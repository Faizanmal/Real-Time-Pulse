ALTER TABLE "Integration"
ADD COLUMN "tokenEncryptionVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Integration"
ADD CONSTRAINT "Integration_tokenEncryptionVersion_check"
CHECK ("tokenEncryptionVersion" IN (0, 1));
