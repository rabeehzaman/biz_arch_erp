import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { restoreStockFromConsumptions, recalculateFromDate } from "@/lib/inventory/fifo";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
            lotConsumptions: true,
          },
        },
        payments: true,
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
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    const invoice = await prisma.invoice.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Failed to update invoice:", error);
    return NextResponse.json(
      { error: "Failed to update invoice" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get invoice with items and consumptions
    const invoice = await prisma.invoice.findUnique({
      where: { id },
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

      // Delete invoice (cascade will delete items and their consumptions)
      await tx.invoice.delete({
        where: { id },
      });

      // Update customer balance (subtract the unpaid amount)
      const unpaidAmount = Number(invoice.total) - Number(invoice.amountPaid);
      await tx.customer.update({
        where: { id: invoice.customerId },
        data: {
          balance: { decrement: unpaidAmount },
        },
      });

      // Recalculate FIFO for affected products
      for (const { productId } of productsWithConsumptions) {
        await recalculateFromDate(productId, invoice.issueDate, tx);
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete invoice:", error);
    return NextResponse.json(
      { error: "Failed to delete invoice" },
      { status: 500 }
    );
  }
}
