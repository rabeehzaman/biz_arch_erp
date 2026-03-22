-- CreateEnum
CREATE TYPE "POSCashMovementType" AS ENUM ('CASH_IN', 'CASH_OUT');

-- AlterEnum
ALTER TYPE "JournalSourceType" ADD VALUE 'POS_CASH_MOVEMENT';

-- AlterTable: Add posSessionId to supplier_payments
ALTER TABLE "supplier_payments" ADD COLUMN "posSessionId" TEXT;

-- AlterTable: Add posSessionId to expenses
ALTER TABLE "expenses" ADD COLUMN "posSessionId" TEXT;

-- AlterTable: Add posSessionId to cash_bank_transactions
ALTER TABLE "cash_bank_transactions" ADD COLUMN "posSessionId" TEXT;

-- CreateTable: pos_cash_movements
CREATE TABLE "pos_cash_movements" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "POSCashMovementType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "journalEntryId" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pos_cash_movements_sessionId_idx" ON "pos_cash_movements"("sessionId");
CREATE INDEX "pos_cash_movements_organizationId_idx" ON "pos_cash_movements"("organizationId");

-- CreateIndex: posSessionId indexes
CREATE INDEX "supplier_payments_posSessionId_idx" ON "supplier_payments"("posSessionId");
CREATE INDEX "expenses_posSessionId_idx" ON "expenses"("posSessionId");
CREATE INDEX "cash_bank_transactions_posSessionId_idx" ON "cash_bank_transactions"("posSessionId");

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_posSessionId_fkey" FOREIGN KEY ("posSessionId") REFERENCES "pos_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_posSessionId_fkey" FOREIGN KEY ("posSessionId") REFERENCES "pos_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cash_bank_transactions" ADD CONSTRAINT "cash_bank_transactions_posSessionId_fkey" FOREIGN KEY ("posSessionId") REFERENCES "pos_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pos_cash_movements" ADD CONSTRAINT "pos_cash_movements_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "pos_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_cash_movements" ADD CONSTRAINT "pos_cash_movements_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pos_cash_movements" ADD CONSTRAINT "pos_cash_movements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
