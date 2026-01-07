import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { QuotationPDF } from "@/components/pdf/quotation-pdf";
import { createElement } from "react";
import { format } from "date-fns";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch quotation with customer and items
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: true,
        items: true,
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
    }));

    // Prepare quotation data for PDF
    const quotationData = {
      quotationNumber: quotation.quotationNumber,
      issueDate: quotation.issueDate,
      validUntil: quotation.validUntil,
      customer: {
        name: quotation.customer.name,
        address: quotation.customer.address,
        city: quotation.customer.city,
        state: quotation.customer.state,
      },
      items: pdfItems,
      subtotal: Number(quotation.subtotal),
      taxAmount: Number(quotation.taxAmount),
      total: Number(quotation.total),
    };

    // Generate PDF
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(
      createElement(QuotationPDF, { quotation: quotationData }) as any
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
