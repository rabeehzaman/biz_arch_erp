-- Add edition column to Organization
ALTER TABLE "organizations" ADD COLUMN "edition" TEXT NOT NULL DEFAULT 'INDIA';

-- Auto-classify existing Saudi orgs based on their current flags
UPDATE "organizations" SET "edition" = 'SAUDI'
  WHERE "saudiEInvoiceEnabled" = true OR "currency" = 'SAR';
