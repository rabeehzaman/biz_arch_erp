CREATE TABLE "pos_register_configs" (
    "id" TEXT NOT NULL,
    "locationKey" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "warehouseId" TEXT,
    "defaultCashAccountId" TEXT,
    "defaultBankAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_register_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pos_register_configs_organizationId_locationKey_key"
ON "pos_register_configs"("organizationId", "locationKey");

CREATE INDEX "pos_register_configs_organizationId_idx"
ON "pos_register_configs"("organizationId");

CREATE INDEX "pos_register_configs_branchId_idx"
ON "pos_register_configs"("branchId");

CREATE INDEX "pos_register_configs_warehouseId_idx"
ON "pos_register_configs"("warehouseId");

ALTER TABLE "pos_register_configs"
ADD CONSTRAINT "pos_register_configs_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pos_register_configs"
ADD CONSTRAINT "pos_register_configs_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "branches"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pos_register_configs"
ADD CONSTRAINT "pos_register_configs_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pos_register_configs"
ADD CONSTRAINT "pos_register_configs_defaultCashAccountId_fkey"
FOREIGN KEY ("defaultCashAccountId") REFERENCES "cash_bank_accounts"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pos_register_configs"
ADD CONSTRAINT "pos_register_configs_defaultBankAccountId_fkey"
FOREIGN KEY ("defaultBankAccountId") REFERENCES "cash_bank_accounts"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
