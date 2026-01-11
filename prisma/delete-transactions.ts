// Script to delete all invoice, purchase invoice, and quotation transactions
// Run with: npx tsx prisma/delete-transactions.ts

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function deleteTransactions() {
  console.log('🗑️  Deleting all invoice, purchase invoice, and quotation transactions...\n')

  try {
    // === INVOICE-RELATED DELETIONS ===

    // 1. Delete stock lot consumptions (references invoice items)
    const deletedConsumptions = await prisma.stockLotConsumption.deleteMany({});
    console.log(`✓ Deleted ${deletedConsumptions.count} stock lot consumptions`);

    // 2. Delete customer transactions (references invoices)
    const deletedCustomerTx = await prisma.customerTransaction.deleteMany({});
    console.log(`✓ Deleted ${deletedCustomerTx.count} customer transactions`);

    // 3. Delete customer payments
    const deletedPayments = await prisma.payment.deleteMany({});
    console.log(`✓ Deleted ${deletedPayments.count} customer payments`);

    // 4. Delete stock lots from purchases (keep opening stock lots if any remain)
    const deletedPurchaseLots = await prisma.stockLot.deleteMany({
      where: { sourceType: 'PURCHASE' }
    });
    console.log(`✓ Deleted ${deletedPurchaseLots.count} purchase stock lots`);

    // === QUOTATION DELETIONS ===

    // 5. Delete quotations (cascade will delete quotation items)
    const deletedQuotations = await prisma.quotation.deleteMany({});
    console.log(`✓ Deleted ${deletedQuotations.count} quotations`);

    // === INVOICE DELETIONS ===

    // 6. Delete invoices (cascade will delete invoice items)
    const deletedInvoices = await prisma.invoice.deleteMany({});
    console.log(`✓ Deleted ${deletedInvoices.count} invoices`);

    // === PURCHASE INVOICE DELETIONS ===

    // 7. Delete supplier payments
    const deletedSupplierPayments = await prisma.supplierPayment.deleteMany({});
    console.log(`✓ Deleted ${deletedSupplierPayments.count} supplier payments`);

    // 8. Delete purchase invoices (cascade will delete purchase invoice items)
    const deletedPurchaseInvoices = await prisma.purchaseInvoice.deleteMany({});
    console.log(`✓ Deleted ${deletedPurchaseInvoices.count} purchase invoices`);

    // === RESET BALANCES ===

    // 9. Reset customer balances to 0
    const updatedCustomers = await prisma.customer.updateMany({
      data: { balance: 0 }
    });
    console.log(`✓ Reset ${updatedCustomers.count} customer balances to 0`);

    // 10. Reset supplier balances to 0
    const updatedSuppliers = await prisma.supplier.updateMany({
      data: { balance: 0 }
    });
    console.log(`✓ Reset ${updatedSuppliers.count} supplier balances to 0`);

    console.log('\n✅ All invoice, purchase invoice, and quotation transactions have been deleted!');

  } catch (error) {
    console.error('❌ Error deleting transactions:', error);
    throw error;
  }
}

deleteTransactions()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
