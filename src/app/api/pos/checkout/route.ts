import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isSaudiEInvoiceEnabled, isTaxInclusivePrice as isTaxInclusivePriceSession } from "@/lib/auth-utils";
import { extractTaxExclusiveAmount } from "@/lib/tax/tax-inclusive";
import { consumeStockFIFO } from "@/lib/inventory/fifo";
import {
  createAutoJournalEntry,
  getSystemAccount,
  getDefaultCashBankAccount,
} from "@/lib/accounting/journal";
import { getOrgGSTInfo, computeDocumentGST } from "@/lib/gst/document-gst";
import { calculateLineVAT, calculateDocumentVAT, determineSaudiInvoiceType, type LineVATResult } from "@/lib/saudi-vat/calculator";
import { generateTLVQRCode, generateQRCodeDataURL } from "@/lib/saudi-vat/qr-code";
import { generateInvoiceUUID, computeInvoiceHash, getNextICV, getLastInvoiceHash } from "@/lib/saudi-vat/invoice-hash";
import { SAUDI_VAT_RATE } from "@/lib/saudi-vat/constants";
import { getPOSRegisterConfig } from "@/lib/pos/register-config";

 
type Tx = any;

// Generate invoice number inside a transaction: INV-YYYYMMDD-XXX
async function generateInvoiceNumber(organizationId: string, tx: Tx) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `INV-${dateStr}`;

  const lastInvoice = await tx.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix }, organizationId },
    orderBy: { invoiceNumber: "desc" },
  });

  let sequence = 1;
  if (lastInvoice) {
    const lastSequence = parseInt(
      lastInvoice.invoiceNumber.split("-").pop() || "0"
    );
    sequence = lastSequence + 1;
  }

  return `${prefix}-${sequence.toString().padStart(3, "0")}`;
}

// Generate payment number inside a transaction: PAY-YYYYMMDD-XXX
async function generatePaymentNumber(organizationId: string, tx: Tx) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `PAY-${dateStr}`;

  const lastPayment = await tx.payment.findFirst({
    where: { paymentNumber: { startsWith: prefix }, organizationId },
    orderBy: { paymentNumber: "desc" },
  });

  let sequence = 1;
  if (lastPayment) {
    const lastSequence = parseInt(
      lastPayment.paymentNumber.split("-").pop() || "0"
    );
    sequence = lastSequence + 1;
  }

  return `${prefix}-${sequence.toString().padStart(3, "0")}`;
}

interface CheckoutItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  gstRate?: number;
  hsnCode?: string;
}

interface CheckoutPayment {
  method: string;
  amount: number;
  reference?: string;
}

interface CheckoutBody {
  customerId?: string;
  items: CheckoutItem[];
  payments: CheckoutPayment[];
  heldOrderId?: string;
  notes?: string;
  sessionId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const userId = session.user.id;

    const body: CheckoutBody = await request.json();
    const { customerId, items, payments, heldOrderId, notes, sessionId } = body;

    // Validate required fields
    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "At least one item is required" },
        { status: 400 }
      );
    }

    if (!payments) {
      return NextResponse.json(
        { error: "Payments array is missing" },
        { status: 400 }
      );
    }

    // Fetch org for ZATCA/branding info
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        saudiEInvoiceEnabled: true,
        vatNumber: true,
        arabicName: true,
        name: true,
        pdfHeaderImageUrl: true,
        posReceiptLogoUrl: true,
        posReceiptLogoHeight: true,
        brandColor: true,
        currency: true,
        gstEnabled: true,
        posAccountingMode: true,
        isTaxInclusivePrice: true,
      },
    });

    const saudiEnabled = isSaudiEInvoiceEnabled(session) || org?.saudiEInvoiceEnabled;
    const taxInclusive = isTaxInclusivePriceSession(session) || org?.isTaxInclusivePrice;

    if (!saudiEnabled) {
      const VALID_GST_RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 7.5, 12, 18, 28];
      for (const item of items) {
        if (item.gstRate !== undefined && item.gstRate !== null && !VALID_GST_RATES.includes(Number(item.gstRate))) {
          return NextResponse.json(
            { error: `Invalid GST rate: ${item.gstRate}. Valid rates are: ${VALID_GST_RATES.join(", ")}` },
            { status: 400 }
          );
        }
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // ── 1. Validate POS session ──────────────────────────────────────
      const posSession = sessionId
        ? await tx.pOSSession.findFirst({
          where: { id: sessionId, organizationId, status: "OPEN" },
        })
        : await tx.pOSSession.findFirst({
          where: { organizationId, userId, status: "OPEN" },
        });

      if (!posSession) {
        throw new Error("NO_OPEN_SESSION");
      }

      const registerConfig = await getPOSRegisterConfig(
        tx,
        organizationId,
        posSession.branchId,
        posSession.warehouseId
      );

      // ── 2. Resolve customer ──────────────────────────────────────────
      let resolvedCustomerId = customerId;

      if (!resolvedCustomerId) {
        // Always get the earliest Walk-in Customer to avoid ambiguity with duplicates
        let walkInCustomer = await tx.customer.findFirst({
          where: { organizationId, name: "Walk-in Customer" },
          orderBy: { createdAt: "asc" },
        });
        if (!walkInCustomer) {
          walkInCustomer = await tx.customer.create({
            data: { organizationId, name: "Walk-in Customer", isActive: true },
          });
        }
        resolvedCustomerId = walkInCustomer.id;
      }

      // ── 3. Calculate totals ──────────────────────────────────────────
      const now = new Date();

      // Build per-line gross amounts and taxable amounts (for tax-inclusive pricing)
      const lineAmounts = items.map((item) => {
        const grossAmount = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
        const taxRate = saudiEnabled ? SAUDI_VAT_RATE : (item.gstRate || 0);
        const taxableAmount = taxInclusive ? extractTaxExclusiveAmount(grossAmount, taxRate) : grossAmount;
        return { grossAmount, taxableAmount };
      });

      const subtotal = lineAmounts.reduce((sum: number, la: { taxableAmount: number }) => sum + la.taxableAmount, 0);

      // Tax calculation — branch between Saudi VAT and GST
      let totalTax = 0;
      let gstResult = { totalCgst: 0, totalSgst: 0, totalIgst: 0, placeOfSupply: null as string | null, isInterState: false, lineGST: [] as Array<{ hsnCode: string | null; gstRate: number; cgstRate: number; sgstRate: number; igstRate: number; cgstAmount: number; sgstAmount: number; igstAmount: number }> };

      // Saudi VAT vars
      let totalVat: number | null = null;
      let saudiInvoiceType: string | null = null;
      let qrCodeData: string | null = null;
      let invoiceUuid: string | null = null;
      let invoiceCounterValue: number | null = null;
      let previousInvoiceHash: string | null = null;
      let invoiceHash: string | null = null;
      let lineVATResults: LineVATResult[] = [];

      if (saudiEnabled) {
        // POS is always B2C (simplified)
        saudiInvoiceType = determineSaudiInvoiceType();

        // Compute VAT per line (using tax-exclusive base from lineAmounts)
        lineVATResults = items.map((_item, idx) => {
          const taxableAmount = lineAmounts[idx].taxableAmount;
          return calculateLineVAT({ taxableAmount, vatRate: SAUDI_VAT_RATE });
        });

        const docVAT = calculateDocumentVAT(lineVATResults);
        totalVat = docVAT.totalVat;
        totalTax = totalVat;

        // Generate Saudi invoice metadata
        invoiceUuid = generateInvoiceUUID();
        invoiceCounterValue = await getNextICV(tx as unknown as Parameters<typeof getNextICV>[0], organizationId);
        previousInvoiceHash = await getLastInvoiceHash(tx as unknown as Parameters<typeof getLastInvoiceHash>[0], organizationId);

        const sellerName = org?.arabicName || org?.name || "";
        const sellerVat = org?.vatNumber || "";
        const totalInclVat = subtotal + (totalVat ?? 0);
        const totalInclVatStr = totalInclVat.toFixed(2);
        const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
        const vatStr = totalVat.toFixed(2);

        invoiceHash = computeInvoiceHash({
          invoiceNumber: "", // Will be set after generation
          issueDate: timestamp,
          sellerVatNumber: sellerVat,
          totalInclVat: totalInclVatStr,
          totalVat: vatStr,
        });

        if (sellerVat) {
          const tlv = generateTLVQRCode({
            sellerName,
            vatNumber: sellerVat,
            timestamp,
            totalWithVat: totalInclVatStr,
            totalVat: vatStr,
          });
          qrCodeData = tlv;
        }
      } else {
        // GST path (existing)
        const orgGST = await getOrgGSTInfo(tx, organizationId);
        let customerGstin: string | null = null;
        let customerStateCode: string | null = null;
        if (resolvedCustomerId) {
          const cust = await tx.customer.findUnique({
            where: { id: resolvedCustomerId },
            select: { gstin: true, gstStateCode: true },
          });
          customerGstin = cust?.gstin ?? null;
          customerStateCode = cust?.gstStateCode ?? null;
        }
        const lineItemsForGST = items.map((item, idx) => ({
          taxableAmount: lineAmounts[idx].taxableAmount,
          gstRate: item.gstRate || 0,
          hsnCode: item.hsnCode || null,
        }));
        gstResult = computeDocumentGST(orgGST, lineItemsForGST, customerGstin, customerStateCode);
        totalTax = gstResult.totalCgst + gstResult.totalSgst + gstResult.totalIgst;
      }

      const total = subtotal + totalTax;
      const totalPayment = payments.reduce((sum, p) => sum + p.amount, 0);
      const change = Math.max(0, totalPayment - total);

      // ── 3b. Validate stock availability ─────────────────────────────
      const stockWarnings: string[] = [];
      for (const item of items) {
        if (item.productId) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            include: {
              stockLots: {
                where: { remainingQuantity: { gt: 0 } },
                select: { remainingQuantity: true },
              },
            },
          });
          if (product) {
            const availableStock = product.stockLots.reduce(
              (sum: number, lot: { remainingQuantity: unknown }) => sum + Number(lot.remainingQuantity),
              0
            );
            if (item.quantity > availableStock) {
              stockWarnings.push(
                `"${item.name}" has ${availableStock} units available but ${item.quantity} requested.`
              );
            }
          }
        }
      }

      // ── 4. Generate invoice number ───────────────────────────────────
      const invoiceNumber = await generateInvoiceNumber(organizationId, tx);

      // ── 5. Create Invoice ────────────────────────────────────────────

      // Update invoice hash with actual invoice number now that it's generated
      if (saudiEnabled && invoiceHash !== null) {
        const sellerVat = org?.vatNumber || "";
        const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
        invoiceHash = computeInvoiceHash({
          invoiceNumber,
          issueDate: timestamp,
          sellerVatNumber: sellerVat,
          totalInclVat: (subtotal + (totalVat ?? 0)).toFixed(2),
          totalVat: (totalVat ?? 0).toFixed(2),
        });
      }

      const invoiceData: Record<string, unknown> = {
        organizationId,
        invoiceNumber,
        branchId: posSession.branchId,
        warehouseId: posSession.warehouseId,
        customerId: resolvedCustomerId,
        createdById: userId,
        sourceType: "POS",
        posSessionId: posSession.id,
        issueDate: now,
        dueDate: now,
        subtotal,
        total,
        amountPaid: Math.min(totalPayment, total),
        balanceDue: Math.max(0, total - totalPayment),
        notes: notes || null,
      };

      if (saudiEnabled) {
        Object.assign(invoiceData, {
          saudiInvoiceType,
          totalVat,
          qrCodeData,
          invoiceUuid,
          invoiceCounterValue,
          previousInvoiceHash,
          invoiceHash,
          totalCgst: 0,
          totalSgst: 0,
          totalIgst: 0,
        });
      } else {
        Object.assign(invoiceData, {
          totalCgst: gstResult.totalCgst,
          totalSgst: gstResult.totalSgst,
          totalIgst: gstResult.totalIgst,
          placeOfSupply: gstResult.placeOfSupply,
          isInterState: gstResult.isInterState,
        });
      }

      // Build line items
      const lineItemsData = items.map((item, idx) => {
        const base: Record<string, unknown> = {
          organizationId,
          productId: item.productId || null,
          description: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
          total: lineAmounts[idx].taxableAmount,
          costOfGoodsSold: 0,
        };

        if (saudiEnabled && lineVATResults[idx]) {
          Object.assign(base, {
            vatRate: lineVATResults[idx].vatRate,
            vatAmount: lineVATResults[idx].vatAmount,
            vatCategory: lineVATResults[idx].vatCategory || "S",
            gstRate: 0,
            cgstRate: 0, sgstRate: 0, igstRate: 0,
            cgstAmount: 0, sgstAmount: 0, igstAmount: 0,
          });
        } else {
          Object.assign(base, {
            hsnCode: gstResult.lineGST[idx]?.hsnCode || item.hsnCode || null,
            gstRate: gstResult.lineGST[idx]?.gstRate || 0,
            cgstRate: gstResult.lineGST[idx]?.cgstRate || 0,
            sgstRate: gstResult.lineGST[idx]?.sgstRate || 0,
            igstRate: gstResult.lineGST[idx]?.igstRate || 0,
            cgstAmount: gstResult.lineGST[idx]?.cgstAmount || 0,
            sgstAmount: gstResult.lineGST[idx]?.sgstAmount || 0,
            igstAmount: gstResult.lineGST[idx]?.igstAmount || 0,
          });
        }

        return base;
      });

      const invoice = await tx.invoice.create({
        data: {
          ...invoiceData,
          items: {
            create: lineItemsData,
          },
        } as Parameters<typeof tx.invoice.create>[0]["data"],
        include: {
          items: true,
          customer: true,
        },
      });

      // ── 6. FIFO stock consumption ────────────────────────────────────
      const warnings: string[] = [...stockWarnings];

      for (const invoiceItem of invoice.items) {
        if (invoiceItem.productId) {
          const fifoResult = await consumeStockFIFO(
            invoiceItem.productId,
            invoiceItem.quantity,
            invoiceItem.id,
            now,
            tx,
            organizationId,
            posSession.warehouseId
          );

          await tx.invoiceItem.update({
            where: { id: invoiceItem.id },
            data: { costOfGoodsSold: fifoResult.totalCOGS },
          });

          if (fifoResult.warnings.length > 0) {
            warnings.push(...fifoResult.warnings);
          }
        }
      }

      // ── 7. Customer balance ──────────────────────────────────────────
      const balanceImpact = total - Math.min(totalPayment, total);
      if (balanceImpact > 0) {
        await tx.customer.update({
          where: { id: resolvedCustomerId },
          data: { balance: { increment: balanceImpact } },
        });
      }

      // Get current customer balance for running balance calculation
      const customerForBalance = await tx.customer.findUnique({
        where: { id: resolvedCustomerId },
        select: { balance: true },
      });
      let currentRunningBalance = Number(customerForBalance?.balance || 0);

      // Create CustomerTransaction for the invoice
      // Running balance after invoice = previous balance + invoice total
      // (balance was already incremented above for unpaid portion, but running balance
      // tracks cumulative: previous + invoice total before payments)
      const invoiceRunningBalance = currentRunningBalance;
      await tx.customerTransaction.create({
        data: {
          organizationId,
          customerId: resolvedCustomerId,
          transactionType: "INVOICE",
          transactionDate: now,
          amount: total,
          description: `POS Invoice ${invoiceNumber}`,
          invoiceId: invoice.id,
          runningBalance: invoiceRunningBalance,
        },
      });

      // ── 8. Revenue + COGS journal entries ────────────────────────────
      const arAccount = await getSystemAccount(tx, organizationId, "1300");
      const revenueAccount = await getSystemAccount(tx, organizationId, "4100");

      if (arAccount && revenueAccount) {
        const revenueLines: Array<{
          accountId: string;
          description: string;
          debit: number;
          credit: number;
        }> = [
            {
              accountId: arAccount.id,
              description: "Accounts Receivable",
              debit: total,
              credit: 0,
            },
            {
              accountId: revenueAccount.id,
              description: "Sales Revenue",
              debit: 0,
              credit: subtotal,
            },
          ];

        // Tax journal lines
        if (saudiEnabled && totalVat && totalVat > 0) {
          // Saudi VAT: use VAT output account (2240)
          const vatAccount = await getSystemAccount(tx, organizationId, "2240");
          if (vatAccount) revenueLines.push({ accountId: vatAccount.id, description: "VAT Output", debit: 0, credit: totalVat });
        } else {
          // GST journal lines
          if (gstResult.totalCgst > 0) {
            const cgstAccount = await getSystemAccount(tx, organizationId, "2210");
            if (cgstAccount) revenueLines.push({ accountId: cgstAccount.id, description: "CGST Output", debit: 0, credit: gstResult.totalCgst });
          }
          if (gstResult.totalSgst > 0) {
            const sgstAccount = await getSystemAccount(tx, organizationId, "2220");
            if (sgstAccount) revenueLines.push({ accountId: sgstAccount.id, description: "SGST Output", debit: 0, credit: gstResult.totalSgst });
          }
          if (gstResult.totalIgst > 0) {
            const igstAccount = await getSystemAccount(tx, organizationId, "2230");
            if (igstAccount) revenueLines.push({ accountId: igstAccount.id, description: "IGST Output", debit: 0, credit: gstResult.totalIgst });
          }
        }

        await createAutoJournalEntry(tx, organizationId, {
          date: now,
          description: `POS Sale ${invoiceNumber}`,
          sourceType: "INVOICE",
          sourceId: invoice.id,
          branchId: posSession.branchId,
          lines: revenueLines,
        });
      }

      // COGS journal entry
      const finalItems = await tx.invoiceItem.findMany({
        where: { invoiceId: invoice.id },
      });
      const totalCOGS = finalItems.reduce(
        (sum: number, item: { costOfGoodsSold: unknown }) =>
          sum + Number(item.costOfGoodsSold),
        0
      );

      if (totalCOGS > 0) {
        const cogsAccount = await getSystemAccount(
          tx,
          organizationId,
          "5100"
        );
        const inventoryAccount = await getSystemAccount(
          tx,
          organizationId,
          "1400"
        );
        if (cogsAccount && inventoryAccount) {
          await createAutoJournalEntry(tx, organizationId, {
            date: now,
            description: `COGS - ${invoiceNumber}`,
            sourceType: "INVOICE",
            sourceId: invoice.id,
            branchId: posSession.branchId,
            lines: [
              {
                accountId: cogsAccount.id,
                description: "Cost of Goods Sold",
                debit: totalCOGS,
                credit: 0,
              },
              {
                accountId: inventoryAccount.id,
                description: "Inventory",
                debit: 0,
                credit: totalCOGS,
              },
            ],
          });
        }
      }

      // ── 9. Process payments ──────────────────────────────────────────
      const createdPayments = [];
      let remainingInvoiceBalance = total; // Track how much of the invoice is still unpaid

      for (const payment of payments) {
        const paymentNumber = await generatePaymentNumber(organizationId, tx);

        // Allocation is capped at remaining invoice balance to prevent over-allocation
        const allocationAmount = Math.min(payment.amount, remainingInvoiceBalance);
        remainingInvoiceBalance = Math.max(0, remainingInvoiceBalance - allocationAmount);

        const newPayment = await tx.payment.create({
          data: {
            paymentNumber,
            customerId: resolvedCustomerId,
            invoiceId: invoice.id,
            amount: allocationAmount, // Store only the amount applied to the invoice
            paymentDate: now,
            paymentMethod: payment.method as
              | "CASH"
              | "BANK_TRANSFER"
              | "CHECK"
              | "CREDIT_CARD"
              | "UPI"
              | "OTHER",
            reference: payment.reference || null,
            organizationId,
          },
        });

        // Create payment allocation
        if (allocationAmount > 0) {
          await tx.paymentAllocation.create({
            data: {
              paymentId: newPayment.id,
              invoiceId: invoice.id,
              amount: allocationAmount,
              organizationId,
            },
          });
        }

        // Payment journal entry: DR Cash/Bank (or Clearing Account), CR Accounts Receivable
        // Use allocationAmount so AR is correctly reduced (not over-credited)
        if (allocationAmount > 0) {
          const isClearingMode = org?.posAccountingMode === "CLEARING_ACCOUNT";

          if (isClearingMode) {
            // CLEARING_ACCOUNT mode: DR POS Undeposited Funds, CR AR
            // Cash/Bank updates happen at session close
            const clearingAccount = await getSystemAccount(tx, organizationId, "1150");

            if (arAccount && clearingAccount) {
              await createAutoJournalEntry(tx, organizationId, {
                date: now,
                description: `POS Payment ${paymentNumber}`,
                sourceType: "PAYMENT",
                sourceId: newPayment.id,
                branchId: posSession.branchId,
                lines: [
                  {
                    accountId: clearingAccount.id,
                    description: "POS Undeposited Funds",
                    debit: allocationAmount,
                    credit: 0,
                  },
                  {
                    accountId: arAccount.id,
                    description: "Accounts Receivable",
                    debit: 0,
                    credit: allocationAmount,
                  },
                ],
              });
            }
            // No CashBankAccount or CashBankTransaction updates in clearing mode
          } else {
            // DIRECT mode (default): DR Cash/Bank, CR AR — update balances immediately
            const cashBankInfo = await getDefaultCashBankAccount(
              tx,
              organizationId,
              payment.method,
              posSession.branchId,
              payment.method === "CASH"
                ? registerConfig?.defaultCashAccountId
                : registerConfig?.defaultBankAccountId
            );

            if (arAccount && cashBankInfo) {
              await createAutoJournalEntry(tx, organizationId, {
                date: now,
                description: `POS Payment ${paymentNumber}`,
                sourceType: "PAYMENT",
                sourceId: newPayment.id,
                branchId: posSession.branchId,
                lines: [
                  {
                    accountId: cashBankInfo.accountId,
                    description: "Cash/Bank",
                    debit: allocationAmount,
                    credit: 0,
                  },
                  {
                    accountId: arAccount.id,
                    description: "Accounts Receivable",
                    debit: 0,
                    credit: allocationAmount,
                  },
                ],
              });

              // Update CashBankAccount balance (only the amount actually kept)
              await tx.cashBankAccount.update({
                where: { id: cashBankInfo.cashBankAccountId },
                data: { balance: { increment: allocationAmount } },
              });

              // Create CashBankTransaction record
              const updatedCB = await tx.cashBankAccount.findUnique({
                where: { id: cashBankInfo.cashBankAccountId },
              });

              await tx.cashBankTransaction.create({
                data: {
                  cashBankAccountId: cashBankInfo.cashBankAccountId,
                  transactionType: "DEPOSIT",
                  amount: allocationAmount,
                  runningBalance: Number(updatedCB?.balance || 0),
                  description: `POS Payment ${paymentNumber}`,
                  referenceType: "PAYMENT",
                  referenceId: newPayment.id,
                  transactionDate: now,
                  organizationId,
                },
              });
            }
          }
        }

        // Create CustomerTransaction for the payment (negative = credit)
        if (allocationAmount > 0) {
          // Decrement customer balance for the payment
          currentRunningBalance = currentRunningBalance - allocationAmount;
          await tx.customerTransaction.create({
            data: {
              organizationId,
              customerId: resolvedCustomerId,
              transactionType: "PAYMENT",
              transactionDate: now,
              amount: -allocationAmount,
              description: `POS Payment ${paymentNumber}`,
              paymentId: newPayment.id,
              runningBalance: currentRunningBalance,
            },
          });
        }

        createdPayments.push(newPayment);
      }

      // Update invoice amountPaid and balanceDue after all payments
      const totalPaidToInvoice = Math.min(totalPayment, total);
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: totalPaidToInvoice,
          balanceDue: Math.max(0, total - totalPaidToInvoice),
        },
      });

      // ── 10. Update POS session ───────────────────────────────────────
      await tx.pOSSession.update({
        where: { id: posSession.id },
        data: {
          totalSales: { increment: total },
          totalTransactions: { increment: 1 },
        },
      });

      // ── 11. Delete held order if applicable ──────────────────────────
      if (heldOrderId) {
        await tx.pOSHeldOrder.delete({
          where: { id: heldOrderId },
        });
      }

      // ── 12. Return result ────────────────────────────────────────────
      const finalInvoice = await tx.invoice.findUnique({
        where: { id: invoice.id },
        include: {
          items: true,
          customer: true,
        },
      });

      return {
        invoice: finalInvoice,
        payments: createdPayments,
        change,
        warnings,
      };
    }, { timeout: 30000 });

    // Generate QR code data URL for receipt (outside transaction)
    let qrCodeDataURL: string | undefined;
    if (result.invoice?.qrCodeData) {
      try {
        qrCodeDataURL = await generateQRCodeDataURL(result.invoice.qrCodeData);
      } catch (e) {
        console.error("QR code generation failed:", e);
      }
    }

    return NextResponse.json({
      ...result,
      receiptMeta: {
        logoUrl: org?.posReceiptLogoUrl || org?.pdfHeaderImageUrl || null,
        logoHeight: org?.posReceiptLogoHeight ?? 80,
        brandColor: org?.brandColor || null,
        vatNumber: org?.vatNumber || null,
        arabicName: org?.arabicName || null,
        taxLabel: saudiEnabled ? "VAT" : org?.gstEnabled ? "GST" : "Tax",
        qrCodeDataURL: qrCodeDataURL || null,
        currency: org?.currency || "INR",
        isTaxInclusivePrice: taxInclusive || false,
      },
    }, { status: 201 });
  } catch (error) {
    // Handle known business errors with appropriate status codes
    if (error instanceof Error && error.message === "NO_OPEN_SESSION") {
      return NextResponse.json(
        { error: "No open POS session found. Please open a session first." },
        { status: 400 }
      );
    }

    console.error("POS checkout failed:", error);
    return NextResponse.json(
      { error: "POS checkout failed" },
      { status: 500 }
    );
  }
}
