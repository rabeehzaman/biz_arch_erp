import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Generate invoice number: INV-YYYYMMDD-XXX
async function generateInvoiceNumber() {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `INV-${dateStr}`;

  const lastInvoice = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
  });

  let sequence = 1;
  if (lastInvoice) {
    const lastSequence = parseInt(lastInvoice.invoiceNumber.split("-").pop() || "0");
    sequence = lastSequence + 1;
  }

  return `${prefix}-${sequence.toString().padStart(3, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where = status && status !== "all" ? { status: status as never } : {};

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { items: true },
        },
      },
    });

    return NextResponse.json(invoices);
  } catch (error) {
    console.error("Failed to fetch invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, dueDate, items, taxRate, discount, notes, terms } = body;

    if (!customerId || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Customer and items are required" },
        { status: 400 }
      );
    }

    const invoiceNumber = await generateInvoiceNumber();

    // Calculate totals
    const subtotal = items.reduce(
      (sum: number, item: { quantity: number; unitPrice: number }) =>
        sum + item.quantity * item.unitPrice,
      0
    );
    const taxAmount = (subtotal * (taxRate || 0)) / 100;
    const total = subtotal + taxAmount - (discount || 0);
    const balanceDue = total;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        customerId,
        dueDate: new Date(dueDate),
        subtotal,
        taxRate: taxRate || 0,
        taxAmount,
        discount: discount || 0,
        total,
        balanceDue,
        notes: notes || null,
        terms: terms || null,
        items: {
          create: items.map((item: {
            productId?: string;
            description: string;
            quantity: number;
            unitPrice: number;
          }) => ({
            productId: item.productId || null,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
          })),
        },
      },
      include: {
        customer: true,
        items: true,
      },
    });

    // Update customer balance
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        balance: { increment: total },
      },
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error("Failed to create invoice:", error);
    return NextResponse.json(
      { error: "Failed to create invoice" },
      { status: 500 }
    );
  }
}
