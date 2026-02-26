import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { getOrgGSTInfo, computeDocumentGST } from "@/lib/gst/document-gst";

// Generate quotation number: QUO-YYYYMMDD-XXX
async function generateQuotationNumber(organizationId: string) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `QUO-${dateStr}`;

  const lastQuotation = await prisma.quotation.findFirst({
    where: { quotationNumber: { startsWith: prefix }, organizationId },
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
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);

    const quotations = await prisma.quotation.findMany({
      where: { organizationId },
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
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const body = await request.json();
    const { customerId, issueDate, validUntil, items, notes, terms } = body;

    if (!customerId || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Customer and items are required" },
        { status: 400 }
      );
    }

    const VALID_GST_RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 7.5, 12, 18, 28];
    for (const item of items) {
      if (item.gstRate !== undefined && item.gstRate !== null && !VALID_GST_RATES.includes(Number(item.gstRate))) {
        return NextResponse.json(
          { error: `Invalid GST rate: ${item.gstRate}. Valid rates are: ${VALID_GST_RATES.join(", ")}` },
          { status: 400 }
        );
      }
    }

    const quotationNumber = await generateQuotationNumber(organizationId);
    const quotationIssueDate = issueDate ? new Date(issueDate) : new Date();
    const quotationValidUntil = validUntil ? new Date(validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Calculate subtotal with item-level discounts
    const subtotal = items.reduce(
      (sum: number, item: { quantity: number; unitPrice: number; discount?: number }) =>
        sum + item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
      0
    );

    // Compute GST
    const orgGST = await getOrgGSTInfo(prisma, organizationId);
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { gstin: true, gstStateCode: true },
    });
    const lineItemsForGST = items.map((item: { quantity: number; unitPrice: number; discount?: number; gstRate?: number; hsnCode?: string }) => ({
      taxableAmount: item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
      gstRate: item.gstRate || 0,
      hsnCode: item.hsnCode || null,
    }));
    const gstResult = computeDocumentGST(orgGST, lineItemsForGST, customer?.gstin, customer?.gstStateCode);
    const total = subtotal + gstResult.totalTax;

    // Create the quotation
    const quotation = await prisma.quotation.create({
      data: {
        organizationId,
        quotationNumber,
        customerId,
        issueDate: quotationIssueDate,
        validUntil: quotationValidUntil,
        status: "SENT",
        subtotal,
        total,
        totalCgst: gstResult.totalCgst,
        totalSgst: gstResult.totalSgst,
        totalIgst: gstResult.totalIgst,
        placeOfSupply: gstResult.placeOfSupply,
        isInterState: gstResult.isInterState,
        notes: notes || null,
        terms: terms || null,
        items: {
          create: items.map((item: {
            productId?: string;
            description: string;
            quantity: number;
            unitPrice: number;
            discount?: number;
            gstRate?: number;
            hsnCode?: string;
          }, idx: number) => ({
            organizationId,
            productId: item.productId || null,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
            total: item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
            hsnCode: gstResult.lineGST[idx]?.hsnCode || item.hsnCode || null,
            gstRate: gstResult.lineGST[idx]?.gstRate || 0,
            cgstRate: gstResult.lineGST[idx]?.cgstRate || 0,
            sgstRate: gstResult.lineGST[idx]?.sgstRate || 0,
            igstRate: gstResult.lineGST[idx]?.igstRate || 0,
            cgstAmount: gstResult.lineGST[idx]?.cgstAmount || 0,
            sgstAmount: gstResult.lineGST[idx]?.sgstAmount || 0,
            igstAmount: gstResult.lineGST[idx]?.igstAmount || 0,
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
