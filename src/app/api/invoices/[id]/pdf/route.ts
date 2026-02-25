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

    // Fetch invoice with customer and items
    const invoice = await prisma.invoice.findUnique({
      where: { id, organizationId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            balance: true,
          },
        },
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

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Calculate balance information
    const currentBalance = Number(invoice.customer.balance);
    const invoiceTotal = Number(invoice.total);
    const oldBalance = currentBalance - invoiceTotal;

    const balanceInfo = {
      oldBalance: oldBalance,
      sales: invoiceTotal,
      balance: currentBalance,
    };

    // Transform items for PDF
    const pdfItems = invoice.items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      discount: Number(item.discount),
      total: Number(item.total),
      product: item.product,
    }));

    // Prepare invoice data for PDF
    const pdfInvoice = {
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      customer: {
        name: invoice.customer.name,
        address: invoice.customer.address,
        city: invoice.customer.city,
        state: invoice.customer.state,
      },
      items: pdfItems,
      subtotal: Number(invoice.subtotal),
      totalCgst: Number(invoice.totalCgst),
      totalSgst: Number(invoice.totalSgst),
      totalIgst: Number(invoice.totalIgst),
      total: Number(invoice.total),
    };

    // Generate PDF
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(
      createElement(InvoicePDF, {
        invoice: pdfInvoice,
        type: "SALES",
        balanceInfo,
      }) as any
    );

    // Return PDF as response
    const filename = `invoice-${invoice.invoiceNumber}-${format(
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
    console.error("Failed to generate invoice PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate invoice PDF" },
      { status: 500 }
    );
  }
}
