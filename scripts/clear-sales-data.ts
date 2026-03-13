/**
 * Clear Sales Data for org slug "qimma-adawi"
 *
 * Deletes all sales-side transaction data while preserving purchases and master data.
 *
 * Usage:
 *   npx tsx scripts/clear-sales-data.ts
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const ORG_SLUG = "qimma-adawi";

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({
    adapter,
    transactionOptions: {
      maxWait: 60000,
      timeout: 60000,
    },
  });

  try {
    // 1. Get org by slug
    const org = await prisma.organization.findFirst({
      where: { slug: ORG_SLUG },
    });

    if (!org) {
      console.error(`Organization with slug "${ORG_SLUG}" not found.`);
      process.exit(1);
    }

    const orgId = org.id;
    console.log(`Found org: ${org.name} (${orgId})`);

    // Pre-deletion counts
    const invoiceCount = await prisma.invoice.count({ where: { organizationId: orgId } });
    const creditNoteCount = await prisma.creditNote.count({ where: { organizationId: orgId } });
    const paymentCount = await prisma.payment.count({ where: { organizationId: orgId } });
    const posSessionCount = await prisma.pOSSession.count({ where: { organizationId: orgId } });
    const quotationCount = await prisma.quotation.count({ where: { organizationId: orgId } });
    const purchaseCount = await prisma.purchaseInvoice.count({ where: { organizationId: orgId } });

    console.log("\n--- Pre-deletion counts ---");
    console.log(`Invoices: ${invoiceCount}`);
    console.log(`Credit Notes: ${creditNoteCount}`);
    console.log(`Payments (customer): ${paymentCount}`);
    console.log(`POS Sessions: ${posSessionCount}`);
    console.log(`Quotations: ${quotationCount}`);
    console.log(`Purchase Invoices: ${purchaseCount} (will be preserved)`);

    console.log("\nStarting deletion in transaction...");

    await prisma.$transaction(async (tx) => {
      // 2. Delete CustomerTransactions
      const r1 = await tx.customerTransaction.deleteMany({
        where: { organizationId: orgId },
      });
      console.log(`Deleted ${r1.count} CustomerTransactions`);

      // 3. Delete PaymentAllocations
      const r2 = await tx.paymentAllocation.deleteMany({
        where: { organizationId: orgId },
      });
      console.log(`Deleted ${r2.count} PaymentAllocations`);

      // 4. Delete Payments
      const r3 = await tx.payment.deleteMany({
        where: { organizationId: orgId },
      });
      console.log(`Deleted ${r3.count} Payments`);

      // 5. Delete CostAuditLogs
      const r4 = await tx.costAuditLog.deleteMany({
        where: { organizationId: orgId },
      });
      console.log(`Deleted ${r4.count} CostAuditLogs`);

      // 6. Delete StockLotConsumptions (only sales-related, i.e. with invoiceItemId)
      const r5 = await tx.stockLotConsumption.deleteMany({
        where: {
          organizationId: orgId,
          invoiceItemId: { not: null },
        },
      });
      console.log(`Deleted ${r5.count} StockLotConsumptions (sales)`);

      // 7. Update MobileDevices — clear sales info, set back to IN_STOCK
      const r6 = await tx.mobileDevice.updateMany({
        where: {
          organizationId: orgId,
          salesInvoiceId: { not: null },
        },
        data: {
          salesInvoiceId: null,
          customerId: null,
          currentStatus: "IN_STOCK",
        },
      });
      console.log(`Reset ${r6.count} MobileDevices to IN_STOCK`);

      // 8. Delete CreditNoteItems
      const r7 = await tx.creditNoteItem.deleteMany({
        where: { organizationId: orgId },
      });
      console.log(`Deleted ${r7.count} CreditNoteItems`);

      // 9. Delete StockLots with sourceType CREDIT_NOTE
      const r8 = await tx.stockLot.deleteMany({
        where: {
          organizationId: orgId,
          sourceType: "CREDIT_NOTE",
        },
      });
      console.log(`Deleted ${r8.count} StockLots (CREDIT_NOTE)`);

      // 10. Delete CreditNotes
      const r9 = await tx.creditNote.deleteMany({
        where: { organizationId: orgId },
      });
      console.log(`Deleted ${r9.count} CreditNotes`);

      // 11. Clear Quotation.convertedInvoiceId before deleting invoices
      await tx.quotation.updateMany({
        where: {
          organizationId: orgId,
          convertedInvoiceId: { not: null },
        },
        data: {
          convertedInvoiceId: null,
          convertedAt: null,
          status: "SENT",
        },
      });

      // 12. Delete InvoiceItems
      const r10 = await tx.invoiceItem.deleteMany({
        where: { organizationId: orgId },
      });
      console.log(`Deleted ${r10.count} InvoiceItems`);

      // 13. Delete Invoices
      const r11 = await tx.invoice.deleteMany({
        where: { organizationId: orgId },
      });
      console.log(`Deleted ${r11.count} Invoices`);

      // 14. Delete POSHeldOrders
      const r12 = await tx.pOSHeldOrder.deleteMany({
        where: { organizationId: orgId },
      });
      console.log(`Deleted ${r12.count} POSHeldOrders`);

      // 15. Delete POSSessions
      const r13 = await tx.pOSSession.deleteMany({
        where: { organizationId: orgId },
      });
      console.log(`Deleted ${r13.count} POSSessions`);

      // 16. POSRegisterConfigs are preserved (register account settings)

      // 17. Delete QuotationItems
      const r15 = await tx.quotationItem.deleteMany({
        where: { organizationId: orgId },
      });
      console.log(`Deleted ${r15.count} QuotationItems`);

      // 18. Delete Quotations
      const r16 = await tx.quotation.deleteMany({
        where: { organizationId: orgId },
      });
      console.log(`Deleted ${r16.count} Quotations`);

      // 19. Reset StockLot remainingQuantity = initialQuantity for all remaining lots
      await tx.$executeRaw`
        UPDATE stock_lots
        SET "remainingQuantity" = "initialQuantity", "updatedAt" = NOW()
        WHERE "organizationId" = ${orgId}
      `;
      console.log("Reset all StockLot remainingQuantity = initialQuantity");
    }, {
      timeout: 60000, // 60s timeout for large datasets
    });

    // Verification
    console.log("\n--- Post-deletion verification ---");
    const postInvoices = await prisma.invoice.count({ where: { organizationId: orgId } });
    const postCreditNotes = await prisma.creditNote.count({ where: { organizationId: orgId } });
    const postPayments = await prisma.payment.count({ where: { organizationId: orgId } });
    const postPosSessions = await prisma.pOSSession.count({ where: { organizationId: orgId } });
    const postQuotations = await prisma.quotation.count({ where: { organizationId: orgId } });
    const postPurchases = await prisma.purchaseInvoice.count({ where: { organizationId: orgId } });

    console.log(`Invoices: ${postInvoices} (should be 0)`);
    console.log(`Credit Notes: ${postCreditNotes} (should be 0)`);
    console.log(`Payments: ${postPayments} (should be 0)`);
    console.log(`POS Sessions: ${postPosSessions} (should be 0)`);
    console.log(`Quotations: ${postQuotations} (should be 0)`);
    console.log(`Purchase Invoices: ${postPurchases} (should be ${purchaseCount})`);

    console.log("\nDone! Sales data cleared successfully.");

    await prisma.$disconnect();
  } catch (error) {
    console.error("Error:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
