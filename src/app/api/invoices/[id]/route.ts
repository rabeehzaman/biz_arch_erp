import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isTaxInclusivePrice as isTaxInclusivePriceSession, isSaudiEInvoiceEnabled } from "@/lib/auth-utils";
import { extractTaxExclusiveAmount } from "@/lib/tax/tax-inclusive";
import { restoreStockFromConsumptions, recalculateFromDate, consumeStockFIFO, isBackdated, getRecalculationStartDate } from "@/lib/inventory/fifo";
import { syncInvoiceRevenueJournal, syncInvoiceCOGSJournal } from "@/lib/accounting/journal";
import { getOrgGSTInfo, computeDocumentGST } from "@/lib/gst/document-gst";
import { calculateLineVAT, calculateDocumentVAT, LineVATResult } from "@/lib/saudi-vat/calculator";
import { SAUDI_VAT_RATE, VATCategory } from "@/lib/saudi-vat/constants";
import { toMidnightUTC } from "@/lib/date-utils";
import { calculateRoundOff, getOrganizationRoundOffMode } from "@/lib/round-off";

// Helper to check if user can access an invoice (based on customer assignment)
async function canAccessInvoice(invoiceId: string, userId: string, isAdmin: boolean, organizationId: string) {
  if (isAdmin) return true;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId, organizationId },
    select: {
      customer: {
        select: {
          assignments: {
            where: { userId },
            select: { id: true }
          }
        }
      }
    },
  });

  if (!invoice) return false;

  return invoice.customer.assignments.length > 0;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;
    const isAdmin = session.user.role === "admin";

    if (!await canAccessInvoice(id, session.user.id, isAdmin, organizationId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id, organizationId },
      include: {
        customer: true,
        items: {
          include: {
            product: {
              include: {
                unit: true,
              },
            },
            lotConsumptions: true,
          },
        },
        payments: true,
        createdBy: {
          select: { id: true, name: true },
        },
        branch: { select: { id: true, name: true, code: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        zatcaSubmissions: {
          orderBy: { createdAt: "desc" as const },
          take: 1,
          select: {
            id: true,
            submissionMode: true,
            status: true,
            warningMessages: true,
            errorMessages: true,
            attemptCount: true,
            lastAttemptAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Failed to fetch invoice:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;
    const isAdmin = session.user.role === "admin";

    if (!await canAccessInvoice(id, session.user.id, isAdmin, organizationId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { customerId, issueDate, dueDate, notes, terms, items, warehouseId: bodyWarehouseId, paymentType, isTaxInclusive, applyRoundOff } = body;

    const existingInvoice = await prisma.invoice.findUnique({
      where: { id, organizationId },
      include: {
        items: {
          include: {
            lotConsumptions: true,
          },
        },
      },
    });

    if (!existingInvoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Resolve effective warehouseId (allow updating it, fall back to existing)
    const effectiveWarehouseId = bodyWarehouseId !== undefined ? bodyWarehouseId : existingInvoice.warehouseId;

    // Check if any items have stock consumptions
    const hasConsumptions = existingInvoice.items.some(
      (item) => item.lotConsumptions.length > 0
    );

    const result = await prisma.$transaction(async (tx) => {
      // Collect warnings from FIFO consumption
      const warnings: string[] = [];

      // Get products that had consumptions for FIFO recalculation
      const productsWithConsumptions = existingInvoice.items
        .filter((item) => item.lotConsumptions.length > 0)
        .map((item) => item.productId!)
        .filter(Boolean);

      // Restore stock from old consumptions
      for (const item of existingInvoice.items) {
        if (item.lotConsumptions.length > 0) {
          await restoreStockFromConsumptions(item.id, tx);
        }
      }

      // Delete old auto journal entries so they get recreated with updated amounts
      await tx.journalEntry.deleteMany({
        where: { sourceType: "INVOICE", sourceId: id, organizationId },
      });

      // Delete old items
      await tx.invoiceItem.deleteMany({
        where: { invoiceId: id },
      });

      // Check tax-inclusive pricing
      const [org, roundOffMode] = await Promise.all([
        tx.organization.findUnique({
          where: { id: organizationId },
          select: { isTaxInclusivePrice: true },
        }),
        getOrganizationRoundOffMode(tx, organizationId),
      ]);
      const taxInclusive = isTaxInclusive ?? (isTaxInclusivePriceSession(session) || org?.isTaxInclusivePrice);

      const saudiEnabled = isSaudiEInvoiceEnabled(session);

      // Build per-line gross amounts and taxable amounts
      const lineAmounts = items.map((item: { quantity: number; unitPrice: number; discount?: number; gstRate?: number; vatRate?: number }) => {
        const grossAmount = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
        const taxRate = saudiEnabled ? (item.vatRate !== undefined ? Number(item.vatRate) : SAUDI_VAT_RATE) : (item.gstRate || 0);
        const taxableAmount = taxInclusive ? extractTaxExclusiveAmount(grossAmount, taxRate) : grossAmount;
        return { grossAmount, taxableAmount };
      });

      // Calculate subtotal (sum of tax-exclusive base amounts)
      const subtotal = lineAmounts.reduce((sum: number, la: { taxableAmount: number }) => sum + la.taxableAmount, 0);

      // Tax computation — branch between Saudi VAT and GST
      let totalTax = 0;
      let gstResult = { totalCgst: 0, totalSgst: 0, totalIgst: 0, placeOfSupply: null as string | null, isInterState: false, lineGST: [] as Array<{ hsnCode: string | null; gstRate: number; cgstRate: number; sgstRate: number; igstRate: number; cgstAmount: number; sgstAmount: number; igstAmount: number }> };
      let totalVat: number | null = null;
      let lineVATResults: LineVATResult[] = [];

      if (saudiEnabled) {
        lineVATResults = items.map((item: { quantity: number; unitPrice: number; discount?: number; vatRate?: number; vatCategory?: string }, idx: number) => {
          const taxableAmount = lineAmounts[idx].taxableAmount;
          const vatRate = item.vatRate !== undefined ? Number(item.vatRate) : SAUDI_VAT_RATE;
          return calculateLineVAT({ taxableAmount, vatRate, vatCategory: item.vatCategory as VATCategory | undefined });
        });
        const docVAT = calculateDocumentVAT(lineVATResults);
        totalVat = docVAT.totalVat;
        totalTax = totalVat;
      } else {
        const orgGST = await getOrgGSTInfo(tx, organizationId);
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
          select: { gstin: true, gstStateCode: true },
        });
        const lineItems = items.map((item: { quantity: number; unitPrice: number; discount?: number; gstRate?: number; hsnCode?: string; conversionFactor?: number }, idx: number) => ({
          taxableAmount: lineAmounts[idx].taxableAmount,
          gstRate: item.gstRate || 0,
          hsnCode: item.hsnCode || null,
        }));
        gstResult = computeDocumentGST(orgGST, lineItems, customer?.gstin, customer?.gstStateCode);
        totalTax = gstResult.totalCgst + gstResult.totalSgst + gstResult.totalIgst;
      }

      const shouldApplyRoundOff = (applyRoundOff ?? existingInvoice.applyRoundOff) === true && roundOffMode !== "NONE";
      const { roundOffAmount, roundedTotal } = calculateRoundOff(
        subtotal + totalTax,
        roundOffMode,
        shouldApplyRoundOff
      );
      const total = roundedTotal;

      // Calculate balance change for customer
      const oldTotal = Number(existingInvoice.total);
      const oldAmountPaid = Number(existingInvoice.amountPaid);
      const oldBalanceDue = oldTotal - oldAmountPaid;
      const newBalanceDue = total - oldAmountPaid;
      const balanceChange = newBalanceDue - oldBalanceDue;

      // Update invoice
      await tx.invoice.update({
        where: { id, organizationId },
        data: {
          customerId,
          issueDate: toMidnightUTC(issueDate),
          dueDate: toMidnightUTC(dueDate),
          notes,
          terms,
          subtotal,
          total,
          balanceDue: newBalanceDue,
          totalCgst: saudiEnabled ? 0 : gstResult.totalCgst,
          totalSgst: saudiEnabled ? 0 : gstResult.totalSgst,
          totalIgst: saudiEnabled ? 0 : gstResult.totalIgst,
          roundOffAmount,
          applyRoundOff: shouldApplyRoundOff,
          placeOfSupply: saudiEnabled ? null : gstResult.placeOfSupply,
          isInterState: saudiEnabled ? false : gstResult.isInterState,
          totalVat: saudiEnabled ? totalVat : null,
          warehouseId: effectiveWarehouseId || null,
          paymentType,
          isTaxInclusive: isTaxInclusive ?? null,
          items: {
            create: items.map((item: {
              productId: string;
              description: string;
              quantity: number;
              unitPrice: number;
              discount?: number;
              gstRate?: number;
              hsnCode?: string;
              unitId?: string;
              conversionFactor?: number;
              vatRate?: number;
              vatCategory?: string;
            }, idx: number) => ({
              organizationId,
              productId: item.productId,
              description: item.description,
              quantity: item.quantity,
              unitId: item.unitId || null,
              conversionFactor: item.conversionFactor || 1,
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              total: lineAmounts[idx].taxableAmount,
              hsnCode: saudiEnabled ? null : (gstResult.lineGST[idx]?.hsnCode || item.hsnCode || null),
              gstRate: saudiEnabled ? 0 : (gstResult.lineGST[idx]?.gstRate || 0),
              cgstRate: saudiEnabled ? 0 : (gstResult.lineGST[idx]?.cgstRate || 0),
              sgstRate: saudiEnabled ? 0 : (gstResult.lineGST[idx]?.sgstRate || 0),
              igstRate: saudiEnabled ? 0 : (gstResult.lineGST[idx]?.igstRate || 0),
              cgstAmount: saudiEnabled ? 0 : (gstResult.lineGST[idx]?.cgstAmount || 0),
              sgstAmount: saudiEnabled ? 0 : (gstResult.lineGST[idx]?.sgstAmount || 0),
              igstAmount: saudiEnabled ? 0 : (gstResult.lineGST[idx]?.igstAmount || 0),
              vatRate: lineVATResults[idx]?.vatRate ?? null,
              vatAmount: lineVATResults[idx]?.vatAmount ?? null,
              vatCategory: lineVATResults[idx]?.vatCategory ?? null,
              costOfGoodsSold: 0,
            })),
          },
        },
      });

      // Update customer balance
      const customerChanged = customerId !== existingInvoice.customerId;

      if (customerChanged) {
        // Remove old invoice impact from old customer
        await tx.customer.update({
          where: { id: existingInvoice.customerId, organizationId },
          data: { balance: { decrement: oldBalanceDue } },
        });
        // Add new invoice impact to new customer
        await tx.customer.update({
          where: { id: customerId, organizationId },
          data: { balance: { increment: newBalanceDue } },
        });
        // Update and move CustomerTransaction to new customer
        await tx.customerTransaction.updateMany({
          where: { invoiceId: id },
          data: { customerId, amount: total },
        });
      } else if (balanceChange !== 0) {
        // Same customer, total changed — apply delta
        await tx.customer.update({
          where: { id: customerId, organizationId },
          data: { balance: { increment: balanceChange } },
        });
        await tx.customerTransaction.updateMany({
          where: { invoiceId: id },
          data: { amount: total },
        });
      }

      // Get the updated invoice with items
      const updatedInvoice = await tx.invoice.findUnique({
        where: { id },
        include: { items: true },
      });

      // Get unique product IDs to check for backdating
      const productIds = items
        .filter((item: { productId?: string }) => item.productId)
        .map((item: { productId: string }) => item.productId);
      const uniqueProductIds: string[] = [...new Set<string>(productIds)];

      // Check if any products are backdated before consuming
      const backdatedProducts = new Set<string>();
      for (const productId of uniqueProductIds) {
        const backdated = await isBackdated(productId, new Date(issueDate), tx);
        if (backdated) {
          backdatedProducts.add(productId);
        }
      }

      // Consume stock for each new item with a productId
      if (updatedInvoice) {
        const newInvoiceDate = new Date(issueDate);
        for (const invoiceItem of updatedInvoice.items) {
          if (invoiceItem.productId) {
            if (!backdatedProducts.has(invoiceItem.productId)) {
              // Calculate base quantity to consume based on conversionFactor
              const baseQuantity = Number(invoiceItem.quantity) * Number(invoiceItem.conversionFactor);

              // Normal flow: consume stock and update COGS
              const fifoResult = await consumeStockFIFO(
                invoiceItem.productId,
                baseQuantity,
                invoiceItem.id,
                newInvoiceDate,
                tx,
                organizationId,
                effectiveWarehouseId
              );

              // Update the invoice item with COGS
              await tx.invoiceItem.update({
                where: { id: invoiceItem.id },
                data: { costOfGoodsSold: fifoResult.totalCOGS },
              });

              // Collect any warnings
              if (fifoResult.warnings.length > 0) {
                warnings.push(...fifoResult.warnings);
              }
            }
            // If backdated, COGS remains 0 and will be set by recalculation
          }
        }
      }

      // Recalculate FIFO for products that had consumptions or are backdated
      const allProductIds = new Set([
        ...productsWithConsumptions,
        ...items
          .filter((item: { productId?: string }) => item.productId)
          .map((item: { productId: string }) => item.productId),
      ]);

      const recalcDate = getRecalculationStartDate(existingInvoice.issueDate, new Date(issueDate));

      for (const productId of allProductIds) {
        const backdated = await isBackdated(productId, new Date(issueDate), tx);
        if (hasConsumptions || backdated) {
          await recalculateFromDate(productId, recalcDate, tx, "recalculation", undefined, organizationId);
        }
      }

      // Recreate journal entries that were deleted at the start
      await syncInvoiceRevenueJournal(tx, organizationId, id);
      await syncInvoiceCOGSJournal(tx, organizationId, id);

      // Fetch the final updated invoice
      const finalInvoice = await tx.invoice.findUnique({
        where: { id },
        include: {
          customer: true,
          items: {
            include: { product: true },
          },
        },
      });

      return { invoice: finalInvoice, warnings };
    }, { timeout: 60000 });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to update invoice:", error);
    return NextResponse.json(
      { error: "Failed to update invoice" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    if (action === "markSent") {
      const invoice = await prisma.invoice.update({
        where: { id, organizationId },
        data: { sentAt: new Date() },
      });
      return NextResponse.json(invoice);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Failed to patch invoice:", error);
    return NextResponse.json({ error: "Failed to update invoice" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;
    const isAdmin = session.user.role === "admin";

    if (!await canAccessInvoice(id, session.user.id, isAdmin, organizationId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get invoice with items and consumptions
    const invoice = await prisma.invoice.findUnique({
      where: { id, organizationId },
      include: {
        items: {
          include: {
            lotConsumptions: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Check which products had stock consumed
    const productsWithConsumptions = invoice.items
      .filter((item) => item.lotConsumptions.length > 0)
      .map((item) => ({
        productId: item.productId!,
        hasConsumptions: true,
      }));

    await prisma.$transaction(async (tx) => {
      // Restore stock for each item
      for (const item of invoice.items) {
        if (item.lotConsumptions.length > 0) {
          await restoreStockFromConsumptions(item.id, tx);
        }
      }

      // Find payments linked to this invoice
      const linkedPayments = await tx.payment.findMany({
        where: { invoiceId: id },
        select: { id: true },
      });
      const paymentIds = linkedPayments.map((p) => p.id);

      // Revert cashbook entries for these payments
      if (paymentIds.length > 0) {
        const cashTransactions = await tx.cashBankTransaction.findMany({
          where: { referenceType: "PAYMENT", referenceId: { in: paymentIds } },
        });

        // Revert cash/bank account balances (deposits increased balance, so we decrement)
        for (const cbTx of cashTransactions) {
          await tx.cashBankAccount.update({
            where: { id: cbTx.cashBankAccountId },
            data: { balance: { decrement: cbTx.amount } },
          });
        }

        // Delete the cash/bank transactions
        await tx.cashBankTransaction.deleteMany({
          where: { referenceType: "PAYMENT", referenceId: { in: paymentIds } },
        });
      }

      // Delete CustomerTransaction records for invoice and its payments
      await tx.customerTransaction.deleteMany({
        where: {
          OR: [
            { invoiceId: id },
            ...(paymentIds.length > 0
              ? [{ paymentId: { in: paymentIds } }]
              : []),
          ],
        },
      });

      // Delete payment allocations for this invoice
      await tx.paymentAllocation.deleteMany({
        where: { invoiceId: id },
      });

      // Delete payments linked to this invoice
      if (paymentIds.length > 0) {
        await tx.journalEntry.deleteMany({
          where: {
            sourceType: "PAYMENT",
            sourceId: { in: paymentIds },
            organizationId,
          },
        });

        await tx.payment.deleteMany({
          where: { id: { in: paymentIds } },
        });
      }

      // Unlink credit notes that reference this invoice
      await tx.creditNote.updateMany({
        where: { invoiceId: id },
        data: { invoiceId: null },
      });

      // Unlink quotation that was converted to this invoice
      await tx.quotation.updateMany({
        where: { convertedInvoiceId: id },
        data: { convertedInvoiceId: null, convertedAt: null },
      });

      // Delete journal entries for this invoice
      await tx.journalEntry.deleteMany({
        where: { sourceType: "INVOICE", sourceId: id, organizationId },
      });

      // Delete invoice (cascade will delete items and their consumptions)
      await tx.invoice.delete({
        where: { id, organizationId },
      });

      // Update customer balance (subtract the unpaid amount)
      const unpaidAmount = Number(invoice.total) - Number(invoice.amountPaid);
      await tx.customer.update({
        where: { id: invoice.customerId, organizationId },
        data: {
          balance: { decrement: unpaidAmount },
        },
      });

      // Recalculate FIFO for affected products
      for (const { productId } of productsWithConsumptions) {
        await recalculateFromDate(productId, invoice.issueDate, tx, "recalculation", undefined, organizationId);
      }
    }, { timeout: 60000 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete invoice:", error);
    return NextResponse.json(
      { error: "Failed to delete invoice" },
      { status: 500 }
    );
  }
}
