import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePDF } from "@/components/pdf/invoice-pdf";
import { createElement } from "react";
import { format } from "date-fns";

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

    // Fetch quotation with customer and items
    const quotation = await prisma.quotation.findUnique({
      where: { id, organizationId },
      include: {
        customer: true,
        items: {
          include: {
            product: {
              select: {
                name: true,
                sku: true,
                unit: true,
              },
            },
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

    // Transform items for PDF
    const pdfItems = quotation.items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      discount: Number(item.discount),
      total: Number(item.total),
      product: item.product,
    }));

    // Prepare invoice-shaped data for PDF
    const invoiceData = {
      invoiceNumber: quotation.quotationNumber,
      issueDate: quotation.issueDate,
      customer: {
        name: quotation.customer.name,
        address: quotation.customer.address,
        city: quotation.customer.city,
        state: quotation.customer.state,
      },
      items: pdfItems,
      subtotal: Number(quotation.subtotal),
      totalCgst: Number(quotation.totalCgst),
      totalSgst: Number(quotation.totalSgst),
      totalIgst: Number(quotation.totalIgst),
      total: Number(quotation.total),
    };

    // Generate PDF
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(
      createElement(InvoicePDF, {
        invoice: invoiceData,
        type: "SALES",
        title: "QUOTATION",
        lang: (session.user as { language?: string }).language || "en",
      }) as any
    );

    // Return PDF as response
    const filename = `quotation-${quotation.quotationNumber}-${format(
      new Date(),
      "yyyy-MM-dd"
    )}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate quotation PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
