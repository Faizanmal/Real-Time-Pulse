ALTER TABLE "integrations"
ADD COLUMN "tokenEncryptionVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "integrations"
ADD CONSTRAINT "integrations_token_encryption_version_check"
CHECK ("tokenEncryptionVersion" IN (0, 1));
