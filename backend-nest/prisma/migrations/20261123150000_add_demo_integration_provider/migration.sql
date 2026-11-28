-- Additive provider value for local, synthetic sample data. No existing row changes.
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'DEMO';
