import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isTaxInclusivePrice as isTaxInclusivePriceSession, isSaudiEInvoiceEnabled } from "@/lib/auth-utils";
import { extractTaxExclusiveAmount } from "@/lib/tax/tax-inclusive";
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

    const quotation = await prisma.quotation.findUnique({
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
          },
        },
        convertedInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
          },
        },
        branch: { select: { id: true, name: true, code: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
    });

    if (!quotation) {
      return NextResponse.json(
        { error: "Quotation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(quotation);
  } catch (error) {
    console.error("Failed to fetch quotation:", error);
    return NextResponse.json(
      { error: "Failed to fetch quotation" },
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
    const body = await request.json();

    // Check if quotation exists and is editable
    const existingQuotation = await prisma.quotation.findUnique({
      where: { id, organizationId },
    });

    if (!existingQuotation) {
      return NextResponse.json(
        { error: "Quotation not found" },
        { status: 404 }
      );
    }

    // Only CONVERTED quotations cannot be edited (they're linked to invoices)
    if (existingQuotation.status === "CONVERTED") {
      return NextResponse.json(
        { error: "Cannot edit a converted quotation" },
        { status: 400 }
      );
    }

    // Prevent direct conversion via PUT
    if (body.status === "CONVERTED") {
      return NextResponse.json(
        { error: "Use the convert endpoint to convert quotation to invoice" },
        { status: 400 }
      );
    }

    const saudiEnabled = isSaudiEInvoiceEnabled(session);

    // If updating items, recalculate totals
    const updateData: Record<string, unknown> = {};

    if (body.customerId !== undefined) {
      updateData.customerId = body.customerId;
    }

    if (body.issueDate !== undefined) {
      updateData.issueDate = toMidnightUTC(body.issueDate);
    }

    if (body.validUntil !== undefined) {
      updateData.validUntil = toMidnightUTC(body.validUntil);
    }

    if (body.notes !== undefined) {
      updateData.notes = body.notes || null;
    }

    if (body.terms !== undefined) {
      updateData.terms = body.terms || null;
    }

    if (body.status !== undefined) {
      updateData.status = body.status;
    }

    // Handle items update
    if (body.items !== undefined) {
      const items = body.items;
      const customerId = body.customerId || existingQuotation.customerId;
      const taxInclusive = isTaxInclusivePriceSession(session);

      // Build per-line gross amounts and taxable amounts
      const lineAmounts = items.map((item: { quantity: number; unitPrice: number; discount?: number; gstRate?: number; vatRate?: number }) => {
        const grossAmount = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
        const taxRate = saudiEnabled ? (item.vatRate !== undefined ? Number(item.vatRate) : SAUDI_VAT_RATE) : (item.gstRate || 0);
        const taxableAmount = taxInclusive ? extractTaxExclusiveAmount(grossAmount, taxRate) : grossAmount;
        return { grossAmount, taxableAmount };
      });

      // Calculate subtotal
      const subtotal = lineAmounts.reduce((sum: number, la: { taxableAmount: number }) => sum + la.taxableAmount, 0);

      // Tax computation
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
        const orgGST = await getOrgGSTInfo(prisma, organizationId);
        const customer = await prisma.customer.findUnique({
          where: { id: customerId },
          select: { gstin: true, gstStateCode: true },
        });
        // NOTE: We do not multiply discount amount by conversionFactor here because unitPrice should conceptually be for the selected unit.
        const lineItemsForGST = items.map((item: { quantity: number; unitPrice: number; discount?: number; gstRate?: number; hsnCode?: string; conversionFactor?: number }, idx: number) => ({
          taxableAmount: lineAmounts[idx].taxableAmount,
          gstRate: item.gstRate || 0,
          hsnCode: item.hsnCode || null,
        }));
        gstResult = computeDocumentGST(orgGST, lineItemsForGST, customer?.gstin, customer?.gstStateCode);
      }

      const totalTax = totalVat !== null ? totalVat : gstResult.totalTax;
      const total = subtotal + totalTax;

      updateData.subtotal = subtotal;
      updateData.total = total;
      updateData.totalCgst = saudiEnabled ? 0 : gstResult.totalCgst;
      updateData.totalSgst = saudiEnabled ? 0 : gstResult.totalSgst;
      updateData.totalIgst = saudiEnabled ? 0 : gstResult.totalIgst;
      updateData.placeOfSupply = saudiEnabled ? null : gstResult.placeOfSupply;
      updateData.isInterState = saudiEnabled ? false : gstResult.isInterState;
      updateData.totalVat = saudiEnabled ? totalVat : null;

      // Delete existing items and create new ones
      updateData.items = {
        deleteMany: {},
        create: items.map((item: {
          productId?: string;
          description: string;
          quantity: number;
          unitPrice: number;
          discount?: number;
          gstRate?: number;
          hsnCode?: string;
          unitId?: string;
          conversionFactor?: number;
        }, idx: number) => ({
          organizationId,
          productId: item.productId || null,
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
        })),
      };
    }

    const quotation = await prisma.quotation.update({
      where: { id, organizationId },
      data: updateData,
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return NextResponse.json(quotation);
  } catch (error) {
    console.error("Failed to update quotation:", error);
    return NextResponse.json(
      { error: "Failed to update quotation" },
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

    // Check if quotation exists
    const quotation = await prisma.quotation.findUnique({
      where: { id, organizationId },
    });

    if (!quotation) {
      return NextResponse.json(
        { error: "Quotation not found" },
        { status: 404 }
      );
    }

    // Prevent deletion of converted quotations
    if (quotation.status === "CONVERTED") {
      return NextResponse.json(
        { error: "Cannot delete a converted quotation" },
        { status: 400 }
      );
    }

    // Delete quotation (cascade will delete items)
    await prisma.quotation.delete({
      where: { id, organizationId },
    });

    return NextResponse.json({ message: "Quotation deleted successfully" });
  } catch (error) {
    console.error("Failed to delete quotation:", error);
    return NextResponse.json(
      { error: "Failed to delete quotation" },
      { status: 500 }
    );
  }
}
