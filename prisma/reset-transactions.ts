// Script to reset all transactions
// Run with: npx tsx prisma/reset-transactions.ts

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function resetTransactions() {
  console.log('🗑️  Resetting all transactions...\n')

  try {
    // Delete in order to respect foreign key constraints

    // 1. Delete stock lot consumptions (references invoiceItems)
    const deletedConsumptions = await prisma.stockLotConsumption.deleteMany({})
    console.log(`✓ Deleted ${deletedConsumptions.count} stock lot consumptions`)

    // 2. Delete customer transactions
    const deletedCustomerTx = await prisma.customerTransaction.deleteMany({})
    console.log(`✓ Deleted ${deletedCustomerTx.count} customer transactions`)

    // 3. Delete customer payments
    const deletedPayments = await prisma.payment.deleteMany({})
    console.log(`✓ Deleted ${deletedPayments.count} customer payments`)

    // 4. Delete supplier payments
    const deletedSupplierPayments = await prisma.supplierPayment.deleteMany({})
    console.log(`✓ Deleted ${deletedSupplierPayments.count} supplier payments`)

    // 5. Delete stock lots
    const deletedStockLots = await prisma.stockLot.deleteMany({})
    console.log(`✓ Deleted ${deletedStockLots.count} stock lots`)

    // 6. Delete opening stocks
    const deletedOpeningStocks = await prisma.openingStock.deleteMany({})
    console.log(`✓ Deleted ${deletedOpeningStocks.count} opening stocks`)

    // 7. Delete invoices (cascade will delete invoice items)
    const deletedInvoices = await prisma.invoice.deleteMany({})
    console.log(`✓ Deleted ${deletedInvoices.count} invoices`)

    // 8. Delete purchase invoices (cascade will delete purchase invoice items)
    const deletedPurchaseInvoices = await prisma.purchaseInvoice.deleteMany({})
    console.log(`✓ Deleted ${deletedPurchaseInvoices.count} purchase invoices`)

    // 9. Reset customer balances to 0
    const updatedCustomers = await prisma.customer.updateMany({
      data: { balance: 0 }
    })
    console.log(`✓ Reset ${updatedCustomers.count} customer balances to 0`)

    // 10. Reset supplier balances to 0
    const updatedSuppliers = await prisma.supplier.updateMany({
      data: { balance: 0 }
    })
    console.log(`✓ Reset ${updatedSuppliers.count} supplier balances to 0`)

    // 11. Delete all customers
    const deletedCustomers = await prisma.customer.deleteMany({})
    console.log(`✓ Deleted ${deletedCustomers.count} customers`)

    // 12. Delete all suppliers
    const deletedSuppliers = await prisma.supplier.deleteMany({})
    console.log(`✓ Deleted ${deletedSuppliers.count} suppliers`)

    console.log('\n✅ All transactions and customers/suppliers have been reset successfully!')

  } catch (error) {
    console.error('❌ Error resetting transactions:', error)
    throw error
  }
}

resetTransactions()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
