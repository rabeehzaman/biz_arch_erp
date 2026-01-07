import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Generate quotation number: QUO-YYYYMMDD-XXX
async function generateQuotationNumber() {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `QUO-${dateStr}`;

  const lastQuotation = await prisma.quotation.findFirst({
    where: { quotationNumber: { startsWith: prefix } },
    orderBy: { quotationNumber: "desc" },
  });

  let sequence = 1;
  if (lastQuotation) {
    const lastSequence = parseInt(lastQuotation.quotationNumber.split("-").pop() || "0");
    sequence = lastSequence + 1;
  }

  return `${prefix}-${sequence.toString().padStart(3, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    const quotations = await prisma.quotation.findMany({
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

    return NextResponse.json(quotations);
  } catch (error) {
    console.error("Failed to fetch quotations:", error);
    return NextResponse.json(
      { error: "Failed to fetch quotations" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, issueDate, validUntil, items, taxRate, notes, terms } = body;

    if (!customerId || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Customer and items are required" },
        { status: 400 }
      );
    }

    const quotationNumber = await generateQuotationNumber();
    const quotationIssueDate = issueDate ? new Date(issueDate) : new Date();
    const quotationValidUntil = validUntil ? new Date(validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Calculate totals with item-level discounts
    const subtotal = items.reduce(
      (sum: number, item: { quantity: number; unitPrice: number; discount?: number }) =>
        sum + item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
      0
    );
    const taxAmount = (subtotal * (taxRate || 0)) / 100;
    const total = subtotal + taxAmount;

    // Create the quotation
    const quotation = await prisma.quotation.create({
      data: {
        quotationNumber,
        customerId,
        issueDate: quotationIssueDate,
        validUntil: quotationValidUntil,
        status: "SENT", // Default status
        subtotal,
        taxRate: taxRate || 0,
        taxAmount,
        total,
        notes: notes || null,
        terms: terms || null,
        items: {
          create: items.map((item: {
            productId?: string;
            description: string;
            quantity: number;
            unitPrice: number;
            discount?: number;
          }) => ({
            productId: item.productId || null,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
            total: item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
          })),
        },
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return NextResponse.json(quotation, { status: 201 });
  } catch (error) {
    console.error("Failed to create quotation:", error);
    return NextResponse.json(
      { error: "Failed to create quotation" },
      { status: 500 }
    );
  }
}
