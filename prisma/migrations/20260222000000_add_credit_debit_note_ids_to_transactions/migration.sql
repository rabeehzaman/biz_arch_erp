-- Add creditNoteId to customer_transactions for reliable credit note transaction lookup
ALTER TABLE "customer_transactions" ADD COLUMN "creditNoteId" TEXT;
ALTER TABLE "customer_transactions" ADD CONSTRAINT "customer_transactions_creditNoteId_fkey"
  FOREIGN KEY ("creditNoteId") REFERENCES "credit_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add debitNoteId to supplier_transactions for reliable debit note transaction lookup
ALTER TABLE "supplier_transactions" ADD COLUMN "debitNoteId" TEXT;
ALTER TABLE "supplier_transactions" ADD CONSTRAINT "supplier_transactions_debitNoteId_fkey"
  FOREIGN KEY ("debitNoteId") REFERENCES "debit_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
