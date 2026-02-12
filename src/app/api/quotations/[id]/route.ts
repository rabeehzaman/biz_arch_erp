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
      updateData.issueDate = new Date(body.issueDate);
    }

    if (body.validUntil !== undefined) {
      updateData.validUntil = new Date(body.validUntil);
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
      const taxRate = body.taxRate !== undefined ? body.taxRate : existingQuotation.taxRate;

      // Calculate totals
      const subtotal = items.reduce(
        (sum: number, item: { quantity: number; unitPrice: number; discount?: number }) =>
          sum + item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
        0
      );
      const taxAmount = (Number(subtotal) * Number(taxRate)) / 100;
      const total = subtotal + taxAmount;

      updateData.subtotal = subtotal;
      updateData.taxRate = taxRate;
      updateData.taxAmount = taxAmount;
      updateData.total = total;

      // Delete existing items and create new ones
      updateData.items = {
        deleteMany: {},
        create: items.map((item: {
          productId?: string;
          description: string;
          quantity: number;
          unitPrice: number;
          discount?: number;
        }) => ({
          organizationId,
          productId: item.productId || null,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
          total: item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
        })),
      };
    } else if (body.taxRate !== undefined && body.taxRate !== existingQuotation.taxRate) {
      // If only tax rate changed, recalculate tax
      const taxAmount = (Number(existingQuotation.subtotal) * Number(body.taxRate)) / 100;
      updateData.taxRate = body.taxRate;
      updateData.taxAmount = taxAmount;
      updateData.total = Number(existingQuotation.subtotal) + taxAmount;
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
      where: { id },
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
