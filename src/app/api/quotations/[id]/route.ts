import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isTaxInclusivePrice as isTaxInclusivePriceSession } from "@/lib/auth-utils";
import { extractTaxExclusiveAmount } from "@/lib/tax/tax-inclusive";
import { getOrgGSTInfo, computeDocumentGST } from "@/lib/gst/document-gst";
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

    // If updating items, recalculate totals
    let updateData: any = {};

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
      const lineAmounts = items.map((item: { quantity: number; unitPrice: number; discount?: number; gstRate?: number }) => {
        const grossAmount = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
        const taxRate = item.gstRate || 0;
        const taxableAmount = taxInclusive ? extractTaxExclusiveAmount(grossAmount, taxRate) : grossAmount;
        return { grossAmount, taxableAmount };
      });

      // Calculate subtotal
      const subtotal = lineAmounts.reduce((sum: number, la: { taxableAmount: number }) => sum + la.taxableAmount, 0);

      // Compute GST
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
      const gstResult = computeDocumentGST(orgGST, lineItemsForGST, customer?.gstin, customer?.gstStateCode);
      const total = subtotal + gstResult.totalTax;

      updateData.subtotal = subtotal;
      updateData.total = total;
      updateData.totalCgst = gstResult.totalCgst;
      updateData.totalSgst = gstResult.totalSgst;
      updateData.totalIgst = gstResult.totalIgst;
      updateData.placeOfSupply = gstResult.placeOfSupply;
      updateData.isInterState = gstResult.isInterState;

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
          hsnCode: gstResult.lineGST[idx]?.hsnCode || item.hsnCode || null,
          gstRate: gstResult.lineGST[idx]?.gstRate || 0,
          cgstRate: gstResult.lineGST[idx]?.cgstRate || 0,
          sgstRate: gstResult.lineGST[idx]?.sgstRate || 0,
          igstRate: gstResult.lineGST[idx]?.igstRate || 0,
          cgstAmount: gstResult.lineGST[idx]?.cgstAmount || 0,
          sgstAmount: gstResult.lineGST[idx]?.sgstAmount || 0,
          igstAmount: gstResult.lineGST[idx]?.igstAmount || 0,
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
