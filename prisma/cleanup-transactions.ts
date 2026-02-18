import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ORG_ID = "default-org";

async function main() {
  console.log(`Cleaning transactional data for organization: ${ORG_ID}\n`);

  const where = { organizationId: ORG_ID };

  // Round 1 — Leaf tables (no dependents)
  console.log("Round 1: Deleting leaf records...");
  const costAuditLogs = await prisma.costAuditLog.deleteMany({ where });
  console.log(`  CostAuditLog: ${costAuditLogs.count}`);

  const stockLotConsumptions = await prisma.stockLotConsumption.deleteMany({ where });
  console.log(`  StockLotConsumption: ${stockLotConsumptions.count}`);

  const debitNoteLotConsumptions = await prisma.debitNoteLotConsumption.deleteMany({ where });
  console.log(`  DebitNoteLotConsumption: ${debitNoteLotConsumptions.count}`);

  const paymentAllocations = await prisma.paymentAllocation.deleteMany({ where });
  console.log(`  PaymentAllocation: ${paymentAllocations.count}`);

  const supplierPaymentAllocations = await prisma.supplierPaymentAllocation.deleteMany({ where });
  console.log(`  SupplierPaymentAllocation: ${supplierPaymentAllocations.count}`);

  const customerTransactions = await prisma.customerTransaction.deleteMany({ where });
  console.log(`  CustomerTransaction: ${customerTransactions.count}`);

  const supplierTransactions = await prisma.supplierTransaction.deleteMany({ where });
  console.log(`  SupplierTransaction: ${supplierTransactions.count}`);

  // Round 2 — Line items
  console.log("\nRound 2: Deleting line items...");
  const creditNoteItems = await prisma.creditNoteItem.deleteMany({ where });
  console.log(`  CreditNoteItem: ${creditNoteItems.count}`);

  const debitNoteItems = await prisma.debitNoteItem.deleteMany({ where });
  console.log(`  DebitNoteItem: ${debitNoteItems.count}`);

  const invoiceItems = await prisma.invoiceItem.deleteMany({ where });
  console.log(`  InvoiceItem: ${invoiceItems.count}`);

  const purchaseInvoiceItems = await prisma.purchaseInvoiceItem.deleteMany({ where });
  console.log(`  PurchaseInvoiceItem: ${purchaseInvoiceItems.count}`);

  const quotationItems = await prisma.quotationItem.deleteMany({ where });
  console.log(`  QuotationItem: ${quotationItems.count}`);

  // Round 3 — Parent documents
  console.log("\nRound 3: Deleting parent documents...");
  const payments = await prisma.payment.deleteMany({ where });
  console.log(`  Payment: ${payments.count}`);

  const supplierPayments = await prisma.supplierPayment.deleteMany({ where });
  console.log(`  SupplierPayment: ${supplierPayments.count}`);

  const creditNotes = await prisma.creditNote.deleteMany({ where });
  console.log(`  CreditNote: ${creditNotes.count}`);

  const debitNotes = await prisma.debitNote.deleteMany({ where });
  console.log(`  DebitNote: ${debitNotes.count}`);

  const quotations = await prisma.quotation.deleteMany({ where });
  console.log(`  Quotation: ${quotations.count}`);

  const invoices = await prisma.invoice.deleteMany({ where });
  console.log(`  Invoice: ${invoices.count}`);

  const purchaseInvoices = await prisma.purchaseInvoice.deleteMany({ where });
  console.log(`  PurchaseInvoice: ${purchaseInvoices.count}`);

  // Round 4 — Inventory
  console.log("\nRound 4: Deleting inventory records...");
  const stockLots = await prisma.stockLot.deleteMany({ where });
  console.log(`  StockLot: ${stockLots.count}`);

  const openingStocks = await prisma.openingStock.deleteMany({ where });
  console.log(`  OpeningStock: ${openingStocks.count}`);

  // Round 5 — Reset balances
  console.log("\nRound 5: Resetting balances...");
  const customers = await prisma.customer.updateMany({
    where: { organizationId: ORG_ID },
    data: { balance: 0 },
  });
  console.log(`  Customer balances reset: ${customers.count}`);

  const suppliers = await prisma.supplier.updateMany({
    where: { organizationId: ORG_ID },
    data: { balance: 0 },
  });
  console.log(`  Supplier balances reset: ${suppliers.count}`);

  console.log("\nCleanup complete!");
}

main()
  .catch((e) => {
    console.error("Cleanup failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
