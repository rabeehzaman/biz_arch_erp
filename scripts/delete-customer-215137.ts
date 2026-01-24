// Script to completely delete customer 215137 including all related data
// Run with: npx tsx scripts/delete-customer-215137.ts

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const CUSTOMER_ID = "cmkb7pjve000004l1qwbjut9z"; // Customer named "215137"

async function deleteCustomer() {
  console.log(`🗑️  Deleting customer ${CUSTOMER_ID} and all related data...\n`);

  try {
    // First, verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: CUSTOMER_ID },
      include: {
        _count: {
          select: {
            invoices: true,
            payments: true,
            transactions: true,
            quotations: true,
            creditNotes: true,
            assignments: true,
          },
        },
      },
    });

    if (!customer) {
      console.log(`❌ Customer ${CUSTOMER_ID} not found!`);
      return;
    }

    console.log(`Found customer: ${customer.name}`);
    console.log(`  - Invoices: ${customer._count.invoices}`);
    console.log(`  - Payments: ${customer._count.payments}`);
    console.log(`  - Transactions: ${customer._count.transactions}`);
    console.log(`  - Quotations: ${customer._count.quotations}`);
    console.log(`  - Credit Notes: ${customer._count.creditNotes}`);
    console.log(`  - Assignments: ${customer._count.assignments}`);
    console.log(`  - Balance: ${customer.balance}\n`);

    await prisma.$transaction(async (tx) => {
      // 1. Delete credit note items for this customer's credit notes
      const creditNotes = await tx.creditNote.findMany({
        where: { customerId: CUSTOMER_ID },
        select: { id: true },
      });
      const creditNoteIds = creditNotes.map((cn) => cn.id);

      if (creditNoteIds.length > 0) {
        const deletedCreditNoteItems = await tx.creditNoteItem.deleteMany({
          where: { creditNoteId: { in: creditNoteIds } },
        });
        console.log(`✓ Deleted ${deletedCreditNoteItems.count} credit note items`);
      }

      // 2. Delete credit notes
      const deletedCreditNotes = await tx.creditNote.deleteMany({
        where: { customerId: CUSTOMER_ID },
      });
      console.log(`✓ Deleted ${deletedCreditNotes.count} credit notes`);

      // 3. Delete payment allocations for this customer's payments
      const payments = await tx.payment.findMany({
        where: { customerId: CUSTOMER_ID },
        select: { id: true },
      });
      const paymentIds = payments.map((p) => p.id);

      if (paymentIds.length > 0) {
        const deletedAllocations = await tx.paymentAllocation.deleteMany({
          where: { paymentId: { in: paymentIds } },
        });
        console.log(`✓ Deleted ${deletedAllocations.count} payment allocations`);
      }

      // 4. Delete customer transactions (including opening balance)
      const deletedTransactions = await tx.customerTransaction.deleteMany({
        where: { customerId: CUSTOMER_ID },
      });
      console.log(`✓ Deleted ${deletedTransactions.count} customer transactions`);

      // 5. Delete payments
      const deletedPayments = await tx.payment.deleteMany({
        where: { customerId: CUSTOMER_ID },
      });
      console.log(`✓ Deleted ${deletedPayments.count} payments`);

      // 6. Get invoices and their stock lot consumptions
      const invoices = await tx.invoice.findMany({
        where: { customerId: CUSTOMER_ID },
        include: { items: true },
      });
      const invoiceItemIds = invoices.flatMap((inv) => inv.items.map((item) => item.id));

      if (invoiceItemIds.length > 0) {
        // Delete stock lot consumptions
        const deletedConsumptions = await tx.stockLotConsumption.deleteMany({
          where: { invoiceItemId: { in: invoiceItemIds } },
        });
        console.log(`✓ Deleted ${deletedConsumptions.count} stock lot consumptions`);

        // Delete cost audit logs
        const deletedAuditLogs = await tx.costAuditLog.deleteMany({
          where: { invoiceItemId: { in: invoiceItemIds } },
        });
        console.log(`✓ Deleted ${deletedAuditLogs.count} cost audit logs`);
      }

      // 7. Delete quotation items
      const quotations = await tx.quotation.findMany({
        where: { customerId: CUSTOMER_ID },
        select: { id: true },
      });
      const quotationIds = quotations.map((q) => q.id);

      if (quotationIds.length > 0) {
        const deletedQuotationItems = await tx.quotationItem.deleteMany({
          where: { quotationId: { in: quotationIds } },
        });
        console.log(`✓ Deleted ${deletedQuotationItems.count} quotation items`);
      }

      // 8. Delete quotations
      const deletedQuotations = await tx.quotation.deleteMany({
        where: { customerId: CUSTOMER_ID },
      });
      console.log(`✓ Deleted ${deletedQuotations.count} quotations`);

      // 9. Delete invoices (cascade will delete invoice items)
      const deletedInvoices = await tx.invoice.deleteMany({
        where: { customerId: CUSTOMER_ID },
      });
      console.log(`✓ Deleted ${deletedInvoices.count} invoices`);

      // 10. Delete customer assignments
      const deletedAssignments = await tx.customerAssignment.deleteMany({
        where: { customerId: CUSTOMER_ID },
      });
      console.log(`✓ Deleted ${deletedAssignments.count} customer assignments`);

      // 11. Finally, delete the customer
      await tx.customer.delete({
        where: { id: CUSTOMER_ID },
      });
      console.log(`✓ Deleted customer ${CUSTOMER_ID}`);
    });

    console.log(`\n✅ Customer ${CUSTOMER_ID} and all related data have been completely deleted!`);
  } catch (error) {
    console.error("❌ Error deleting customer:", error);
    throw error;
  }
}

deleteCustomer()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
