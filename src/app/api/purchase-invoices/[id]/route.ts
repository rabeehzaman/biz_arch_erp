import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isSaudiEInvoiceEnabled, isTaxInclusivePrice as isTaxInclusivePriceSession } from "@/lib/auth-utils";
import { extractTaxExclusiveAmount } from "@/lib/tax/tax-inclusive";
import { recalculateFromDate, getRecalculationStartDate } from "@/lib/inventory/fifo";
import { syncPurchaseJournal } from "@/lib/accounting/journal";
import { getOrgGSTInfo, computeDocumentGST } from "@/lib/gst/document-gst";
import { SAUDI_VAT_RATE } from "@/lib/saudi-vat/constants";
import { toMidnightUTC } from "@/lib/date-utils";

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
    const invoice = await prisma.purchaseInvoice.findUnique({
      where: { id, organizationId },
      include: {
        supplier: true,
        items: {
          include: {
            product: {
              include: {
                unit: true,
              },
            },
            stockLot: true,
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
        },
        branch: { select: { id: true, name: true, code: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Purchase invoice not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Failed to fetch purchase invoice:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchase invoice" },
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
    const saudiEnabled = isSaudiEInvoiceEnabled(session);
    const { id } = await params;
    const body = await request.json();
    const { status, supplierId, invoiceDate, dueDate, supplierInvoiceRef, notes, items } = body;

    const existingInvoice = await prisma.purchaseInvoice.findUnique({
      where: { id, organizationId },
      include: { items: true },
    });

    if (!existingInvoice) {
      return NextResponse.json(
        { error: "Purchase invoice not found" },
        { status: 404 }
      );
    }

    // If only status is being updated
    if (status && !invoiceDate && !items && !supplierId && !dueDate && notes === undefined) {
      const invoice = await prisma.purchaseInvoice.update({
        where: { id, organizationId },
        data: { status },
      });
      return NextResponse.json(invoice);
    }

    // If date or items are being updated, we need to recalculate
    const oldDate = existingInvoice.invoiceDate;
    const newDate = invoiceDate ? toMidnightUTC(invoiceDate) : oldDate;

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { isTaxInclusivePrice: true },
    });
    const taxInclusive = isTaxInclusivePriceSession(session) || org?.isTaxInclusivePrice;

    await prisma.$transaction(async (tx) => {
      // If items are being updated
      if (items) {
        // Delete consumptions on these lots first (no cascade in schema)
        const lots = await tx.stockLot.findMany({
          where: { purchaseInvoiceId: id },
          select: { id: true },
        });
        if (lots.length > 0) {
          await tx.stockLotConsumption.deleteMany({
            where: { stockLotId: { in: lots.map((l) => l.id) } },
          });
        }

        // Delete old stock lots for this purchase
        await tx.stockLot.deleteMany({
          where: { purchaseInvoiceId: id },
        });

        // Delete old auto journal entries so they get recreated with updated amounts
        await tx.journalEntry.deleteMany({
          where: { sourceType: "PURCHASE_INVOICE", sourceId: id, organizationId },
        });

        // Delete old items
        await tx.purchaseInvoiceItem.deleteMany({
          where: { purchaseInvoiceId: id },
        });

        // Calculate new totals with item-level discounts (extract tax-exclusive base when tax-inclusive pricing)
        const lineAmounts = items.map((item: { quantity: number; unitCost: number; discount?: number; gstRate?: number; vatRate?: number }) => {
          const grossAmount = item.quantity * item.unitCost * (1 - (item.discount || 0) / 100);
          const taxRate = saudiEnabled ? (item.vatRate !== undefined ? Number(item.vatRate) : SAUDI_VAT_RATE) : (item.gstRate || 0);
          const taxableAmount = taxInclusive ? extractTaxExclusiveAmount(grossAmount, taxRate) : grossAmount;
          return { grossAmount, taxableAmount, taxRate };
        });

        const subtotal = lineAmounts.reduce((sum: number, la: { taxableAmount: number }) => sum + la.taxableAmount, 0);

        // Compute tax (Saudi VAT or GST)
        const newSupplierId = supplierId || existingInvoice.supplierId;
        let gstResult = { totalCgst: 0, totalSgst: 0, totalIgst: 0, totalTax: 0, placeOfSupply: null as string | null, isInterState: false, lineGST: [] as Array<{ hsnCode: string | null; gstRate: number; cgstRate: number; sgstRate: number; igstRate: number; cgstAmount: number; sgstAmount: number; igstAmount: number }> };
        let totalVat: number | null = null;

        if (saudiEnabled) {
          // Saudi VAT: compute VAT on each line
          let vatTotal = 0;
          for (let idx = 0; idx < items.length; idx++) {
            const taxableAmount = lineAmounts[idx].taxableAmount;
            const rate = items[idx].vatRate !== undefined ? Number(items[idx].vatRate) : SAUDI_VAT_RATE;
            vatTotal += Math.round(taxableAmount * rate) / 100;
          }
          totalVat = Math.round(vatTotal * 100) / 100;
        } else {
          // GST path
          const orgGST = await getOrgGSTInfo(tx, organizationId);
          const supplierData = await tx.supplier.findUnique({
            where: { id: newSupplierId },
            select: { gstin: true, gstStateCode: true },
          });
          // NOTE: We do not multiply discount amount by conversionFactor here because unitCost should conceptually be for the selected unit.
          const lineItemsForGST = items.map((item: { quantity: number; unitCost: number; discount?: number; gstRate?: number; hsnCode?: string; conversionFactor?: number }, idx: number) => ({
            taxableAmount: lineAmounts[idx].taxableAmount,
            gstRate: item.gstRate || 0,
            hsnCode: item.hsnCode || null,
          }));
          gstResult = computeDocumentGST(orgGST, lineItemsForGST, supplierData?.gstin, supplierData?.gstStateCode);
        }

        const totalTax = totalVat !== null ? totalVat : gstResult.totalTax;
        const total = subtotal + totalTax;
        const newBalanceDue = total - Number(existingInvoice.amountPaid);

        // Calculate balance change for supplier
        const oldBalanceDue = Number(existingInvoice.balanceDue);
        const balanceChange = newBalanceDue - oldBalanceDue;

        // Update invoice with new items
        await tx.purchaseInvoice.update({
          where: { id, organizationId },
          data: {
            supplierId: newSupplierId,
            invoiceDate: newDate,
            dueDate: dueDate ? toMidnightUTC(dueDate) : existingInvoice.dueDate,
            supplierInvoiceRef: supplierInvoiceRef !== undefined ? supplierInvoiceRef : existingInvoice.supplierInvoiceRef,
            notes: notes !== undefined ? notes : existingInvoice.notes,
            subtotal,
            total,
            totalCgst: saudiEnabled ? 0 : gstResult.totalCgst,
            totalSgst: saudiEnabled ? 0 : gstResult.totalSgst,
            totalIgst: saudiEnabled ? 0 : gstResult.totalIgst,
            placeOfSupply: saudiEnabled ? null : gstResult.placeOfSupply,
            isInterState: saudiEnabled ? false : gstResult.isInterState,
            totalVat: saudiEnabled ? totalVat : null,
            balanceDue: newBalanceDue,
            items: {
              create: items.map((item: {
                productId: string;
                description: string;
                quantity: number;
                unitCost: number;
                discount?: number;
                gstRate?: number;
                hsnCode?: string;
                unitId?: string;
                conversionFactor?: number;
              }, idx: number) => ({
                organizationId,
                productId: item.productId,
                description: item.description,
                quantity: item.quantity,
                unitId: item.unitId || null,
                conversionFactor: item.conversionFactor || 1,
                unitCost: item.unitCost,
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
              })),
            },
          },
        });

        // Update supplier balance
        const supplierChanged = newSupplierId !== existingInvoice.supplierId;

        if (supplierChanged) {
          // Remove old invoice impact from old supplier
          await tx.supplier.update({
            where: { id: existingInvoice.supplierId, organizationId },
            data: { balance: { decrement: oldBalanceDue } },
          });
          // Add new invoice impact to new supplier
          await tx.supplier.update({
            where: { id: newSupplierId, organizationId },
            data: { balance: { increment: newBalanceDue } },
          });
          // Update and move SupplierTransaction to new supplier
          await tx.supplierTransaction.updateMany({
            where: { purchaseInvoiceId: id },
            data: { supplierId: newSupplierId, amount: total },
          });
        } else if (balanceChange !== 0) {
          // Same supplier, total changed — apply delta
          await tx.supplier.update({
            where: { id: newSupplierId, organizationId },
            data: { balance: { increment: balanceChange } },
          });
          await tx.supplierTransaction.updateMany({
            where: { purchaseInvoiceId: id },
            data: { amount: total },
          });
        }

        // Recreate stock lots
        const updatedInvoice = await tx.purchaseInvoice.findUnique({
          where: { id },
          include: { items: true },
        });

        if (updatedInvoice) {
          for (let index = 0; index < updatedInvoice.items.length; index++) {
            const item = updatedInvoice.items[index];
            // Keep inventory valuation tax-exclusive when the org uses tax-inclusive pricing.
            const netUnitCost = Number(item.quantity) > 0
              ? Number(lineAmounts[index].taxableAmount) / Number(item.quantity)
              : 0;

            // Calculate base unit cost (purchase price / conversion factor)
            const baseUnitCost = netUnitCost / Number(item.conversionFactor);

            // Create stock lot with base quantity
            const baseQuantity = Number(item.quantity) * Number(item.conversionFactor);

            await tx.stockLot.create({
              data: {
                organizationId,
                productId: item.productId,
                sourceType: "PURCHASE",
                purchaseInvoiceItemId: item.id,
                purchaseInvoiceId: id,
                lotDate: newDate,
                unitCost: baseUnitCost, // Store base unit cost for accurate COGS
                initialQuantity: baseQuantity,
                remainingQuantity: baseQuantity,
                warehouseId: existingInvoice.warehouseId || null,
              },
            });

            // Auto-update product.cost to original MRP (pre-discount) for form auto-population
            await tx.product.update({
              where: { id: item.productId },
              data: { cost: Number(item.unitCost) },
            });
          }
        }

        // Recreate purchase journal entry
        await syncPurchaseJournal(tx, organizationId, id);

        // Recalculate FIFO for affected products
        const productIds = [...new Set(items.map((item: { productId: string }) => item.productId))];
        const recalcDate = getRecalculationStartDate(oldDate, newDate);

        for (const productId of productIds) {
          await recalculateFromDate(productId as string, recalcDate, tx, "recalculation", undefined, organizationId);
        }
      } else if (invoiceDate) {
        // Only date is being updated
        await tx.purchaseInvoice.update({
          where: { id, organizationId },
          data: { invoiceDate: newDate },
        });

        // Update lot dates
        await tx.stockLot.updateMany({
          where: { purchaseInvoiceId: id },
          data: { lotDate: newDate },
        });

        // Recalculate FIFO for affected products
        const productIds = existingInvoice.items.map((item) => item.productId);
        const recalcDate = getRecalculationStartDate(oldDate, newDate);

        for (const productId of productIds) {
          await recalculateFromDate(productId, recalcDate, tx, "recalculation", undefined, organizationId);
        }
      }
    }, { timeout: 30000 });

    const updatedInvoice = await prisma.purchaseInvoice.findUnique({
      where: { id, organizationId },
      include: {
        supplier: true,
        items: {
          include: { product: true },
        },
      },
    });

    return NextResponse.json(updatedInvoice);
  } catch (error) {
    console.error("Failed to update purchase invoice:", error);
    return NextResponse.json(
      { error: "Failed to update purchase invoice" },
      { status: 500 }
    );
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

    const invoice = await prisma.purchaseInvoice.findUnique({
      where: { id, organizationId },
      include: {
        items: true,
        stockLots: {
          include: {
            consumptions: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Purchase invoice not found" },
        { status: 404 }
      );
    }

    // Check if any stock from this purchase has been consumed
    const hasConsumptions = invoice.stockLots.some(
      (lot) => lot.consumptions.length > 0
    );

    await prisma.$transaction(async (tx) => {
      const productIds = invoice.items.map((item) => item.productId);
      const invoiceDate = invoice.invoiceDate;

      // Delete SupplierTransaction record for purchase invoice
      // Find payments linked to this purchase invoice
      const linkedPayments = await tx.supplierPayment.findMany({
        where: { purchaseInvoiceId: id },
        select: { id: true },
      });
      const paymentIds = linkedPayments.map((p) => p.id);

      // Revert cashbook entries for these supplier payments
      if (paymentIds.length > 0) {
        const cashTransactions = await tx.cashBankTransaction.findMany({
          where: { referenceType: "SUPPLIER_PAYMENT", referenceId: { in: paymentIds } },
        });

        // Revert cash/bank account balances (withdrawals were negative, so we decrement a negative to add it back)
        for (const cbTx of cashTransactions) {
          await tx.cashBankAccount.update({
            where: { id: cbTx.cashBankAccountId },
            data: { balance: { decrement: cbTx.amount } },
          });
        }

        // Delete the cash/bank transactions
        await tx.cashBankTransaction.deleteMany({
          where: { referenceType: "SUPPLIER_PAYMENT", referenceId: { in: paymentIds } },
        });

        // Delete payment allocations
        await tx.supplierPaymentAllocation.deleteMany({
          where: { purchaseInvoiceId: id },
        });

        // Delete payments
        await tx.supplierPayment.deleteMany({
          where: { id: { in: paymentIds } },
        });
      }

      await tx.supplierTransaction.deleteMany({
        where: {
          OR: [
            { purchaseInvoiceId: id },
            ...(paymentIds.length > 0 ? [{ supplierPaymentId: { in: paymentIds } }] : [])
          ]
        },
      });

      // Delete consumptions on these lots first (no cascade in schema)
      const lots = await tx.stockLot.findMany({
        where: { purchaseInvoiceId: id },
        select: { id: true },
      });
      if (lots.length > 0) {
        await tx.stockLotConsumption.deleteMany({
          where: { stockLotId: { in: lots.map((l) => l.id) } },
        });
      }

      // Delete stock lots
      await tx.stockLot.deleteMany({
        where: { purchaseInvoiceId: id },
      });

      // Update supplier balance (subtract the unpaid amount)
      // Since we deleted the payments above, we must decrement the entire old balance impact 
      // which was total - amountPaid (unpaidAmount). Actually wait, if we delete the payment too, 
      // the unpaid amount and the paid amount both need to be reversed from the supplier balance.
      // So we just decrement the full invoice total from the supplier balance!
      await tx.supplier.update({
        where: { id: invoice.supplierId, organizationId },
        data: {
          balance: { decrement: Number(invoice.total) },
        },
      });

      // Delete journal entries for this purchase invoice
      await tx.journalEntry.deleteMany({
        where: { sourceType: "PURCHASE_INVOICE", sourceId: id, organizationId },
      });

      // Delete the invoice (items will cascade)
      await tx.purchaseInvoice.delete({
        where: { id, organizationId },
      });

      // If there were consumptions, recalculate FIFO for affected products
      if (hasConsumptions) {
        for (const productId of productIds) {
          await recalculateFromDate(productId, invoiceDate, tx, "recalculation", undefined, organizationId);
        }
      }
    }, { timeout: 30000 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete purchase invoice:", error);
    return NextResponse.json(
      { error: "Failed to delete purchase invoice" },
      { status: 500 }
    );
  }
}
