import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

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

    // Verify product belongs to this org
    const product = await prisma.product.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [
      salesItems,
      purchaseItems,
      creditNoteItems,
      debitNoteItems,
      stockTransferItems,
      inventoryAdjustmentItems,
    ] = await Promise.all([
      // 1. Sales invoice items
      prisma.invoiceItem.findMany({
        where: {
          productId: id,
          invoice: { organizationId },
        },
        orderBy: { invoice: { issueDate: "desc" } },
        take: 50,
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          total: true,
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              issueDate: true,
              customer: { select: { name: true } },
            },
          },
        },
      }),
      // 2. Purchase invoice items
      prisma.purchaseInvoiceItem.findMany({
        where: {
          productId: id,
          purchaseInvoice: { organizationId },
        },
        orderBy: { purchaseInvoice: { invoiceDate: "desc" } },
        take: 50,
        select: {
          id: true,
          quantity: true,
          unitCost: true,
          total: true,
          purchaseInvoice: {
            select: {
              id: true,
              purchaseInvoiceNumber: true,
              invoiceDate: true,
              supplier: { select: { name: true } },
            },
          },
        },
      }),
      // 3. Credit note items
      prisma.creditNoteItem.findMany({
        where: {
          productId: id,
          creditNote: { organizationId },
        },
        orderBy: { creditNote: { issueDate: "desc" } },
        take: 50,
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          total: true,
          creditNote: {
            select: {
              id: true,
              creditNoteNumber: true,
              issueDate: true,
            },
          },
        },
      }),
      // 4. Debit note items
      prisma.debitNoteItem.findMany({
        where: {
          productId: id,
          debitNote: { organizationId },
        },
        orderBy: { debitNote: { issueDate: "desc" } },
        take: 50,
        select: {
          id: true,
          quantity: true,
          unitCost: true,
          total: true,
          debitNote: {
            select: {
              id: true,
              debitNoteNumber: true,
              issueDate: true,
            },
          },
        },
      }),
      // 5. Stock transfer items
      prisma.stockTransferItem.findMany({
        where: {
          productId: id,
          stockTransfer: { organizationId },
        },
        orderBy: { stockTransfer: { transferDate: "desc" } },
        take: 50,
        select: {
          id: true,
          quantity: true,
          stockTransfer: {
            select: {
              id: true,
              transferNumber: true,
              transferDate: true,
              sourceWarehouse: { select: { name: true } },
              destinationWarehouse: { select: { name: true } },
            },
          },
        },
      }),
      // 6. Inventory adjustment items
      prisma.inventoryAdjustmentItem.findMany({
        where: {
          productId: id,
          inventoryAdjustment: { organizationId },
        },
        orderBy: { inventoryAdjustment: { adjustmentDate: "desc" } },
        take: 50,
        select: {
          id: true,
          adjustmentType: true,
          quantity: true,
          unitCost: true,
          reason: true,
          inventoryAdjustment: {
            select: {
              id: true,
              adjustmentNumber: true,
              adjustmentDate: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      salesInvoices: salesItems.map((item) => ({
        id: item.id,
        invoiceId: item.invoice.id,
        invoiceNumber: item.invoice.invoiceNumber,
        issueDate: item.invoice.issueDate,
        customerName: item.invoice.customer?.name ?? null,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
      })),
      purchaseInvoices: purchaseItems.map((item) => ({
        id: item.id,
        purchaseInvoiceId: item.purchaseInvoice.id,
        purchaseInvoiceNumber: item.purchaseInvoice.purchaseInvoiceNumber,
        invoiceDate: item.purchaseInvoice.invoiceDate,
        supplierName: item.purchaseInvoice.supplier?.name ?? null,
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
        total: Number(item.total),
      })),
      creditNotes: creditNoteItems.map((item) => ({
        id: item.id,
        creditNoteId: item.creditNote.id,
        creditNoteNumber: item.creditNote.creditNoteNumber,
        issueDate: item.creditNote.issueDate,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
      })),
      debitNotes: debitNoteItems.map((item) => ({
        id: item.id,
        debitNoteId: item.debitNote.id,
        debitNoteNumber: item.debitNote.debitNoteNumber,
        issueDate: item.debitNote.issueDate,
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
        total: Number(item.total),
      })),
      stockTransfers: stockTransferItems.map((item) => ({
        id: item.id,
        stockTransferId: item.stockTransfer.id,
        transferNumber: item.stockTransfer.transferNumber,
        transferDate: item.stockTransfer.transferDate,
        sourceWarehouse: item.stockTransfer.sourceWarehouse.name,
        destinationWarehouse: item.stockTransfer.destinationWarehouse.name,
        quantity: Number(item.quantity),
      })),
      inventoryAdjustments: inventoryAdjustmentItems.map((item) => ({
        id: item.id,
        adjustmentId: item.inventoryAdjustment.id,
        adjustmentNumber: item.inventoryAdjustment.adjustmentNumber,
        adjustmentDate: item.inventoryAdjustment.adjustmentDate,
        adjustmentType: item.adjustmentType,
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
        reason: item.reason,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch product transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch product transactions" },
      { status: 500 }
    );
  }
}
