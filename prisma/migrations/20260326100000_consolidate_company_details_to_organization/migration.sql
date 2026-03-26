-- Add company detail columns to Organization table
ALTER TABLE "organizations" ADD COLUMN "address" TEXT;
ALTER TABLE "organizations" ADD COLUMN "city" TEXT;
ALTER TABLE "organizations" ADD COLUMN "state" TEXT;
ALTER TABLE "organizations" ADD COLUMN "zipCode" TEXT;
ALTER TABLE "organizations" ADD COLUMN "country" TEXT;
ALTER TABLE "organizations" ADD COLUMN "phone" TEXT;
ALTER TABLE "organizations" ADD COLUMN "email" TEXT;
ALTER TABLE "organizations" ADD COLUMN "bankName" TEXT;
ALTER TABLE "organizations" ADD COLUMN "bankAccountNumber" TEXT;
ALTER TABLE "organizations" ADD COLUMN "bankIfscCode" TEXT;
ALTER TABLE "organizations" ADD COLUMN "bankBranch" TEXT;
ALTER TABLE "organizations" ADD COLUMN "roundOffMode" TEXT NOT NULL DEFAULT 'NONE';

-- Migrate existing data from Setting key-value table into Organization columns
UPDATE "organizations" o SET
  "address" = (SELECT s."value" FROM "settings" s WHERE s."organizationId" = o."id" AND s."key" = 'company_address'),
  "city" = (SELECT s."value" FROM "settings" s WHERE s."organizationId" = o."id" AND s."key" = 'company_city'),
  "state" = (SELECT s."value" FROM "settings" s WHERE s."organizationId" = o."id" AND s."key" = 'company_state'),
  "zipCode" = (SELECT s."value" FROM "settings" s WHERE s."organizationId" = o."id" AND s."key" = 'company_zipCode'),
  "country" = (SELECT s."value" FROM "settings" s WHERE s."organizationId" = o."id" AND s."key" = 'company_country'),
  "phone" = (SELECT s."value" FROM "settings" s WHERE s."organizationId" = o."id" AND s."key" = 'company_phone'),
  "email" = (SELECT s."value" FROM "settings" s WHERE s."organizationId" = o."id" AND s."key" = 'company_email'),
  "bankName" = (SELECT s."value" FROM "settings" s WHERE s."organizationId" = o."id" AND s."key" = 'company_bankName'),
  "bankAccountNumber" = (SELECT s."value" FROM "settings" s WHERE s."organizationId" = o."id" AND s."key" = 'company_bankAccountNumber'),
  "bankIfscCode" = (SELECT s."value" FROM "settings" s WHERE s."organizationId" = o."id" AND s."key" = 'company_bankIfscCode'),
  "bankBranch" = (SELECT s."value" FROM "settings" s WHERE s."organizationId" = o."id" AND s."key" = 'company_bankBranch'),
  "roundOffMode" = COALESCE((SELECT s."value" FROM "settings" s WHERE s."organizationId" = o."id" AND s."key" = 'company_roundOffMode'), 'NONE');
