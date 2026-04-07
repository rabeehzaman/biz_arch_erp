import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { renderToBuffer } from "@react-pdf/renderer";
import { PurchaseInvoicePDF } from "@/components/pdf/purchase-invoice-pdf";
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

    // Fetch organization details
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, arabicName: true, arabicAddress: true, vatNumber: true, currency: true },
    });

    // Fetch purchase invoice with supplier and items
    const invoice = await prisma.purchaseInvoice.findUnique({
      where: { id, organizationId },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            balance: true,
            arabicName: true,
            vatNumber: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                name: true,
                sku: true,
                unit: true,
                arabicName: true,
              },
            },
            unit: {
              select: {
                code: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Purchase invoice not found" },
        { status: 404 }
      );
    }

    // Calculate balance information
    const currentBalance = Number(invoice.supplier.balance);
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
      arabicName: item.product?.arabicName ?? null,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitCost),
      discount: Number(item.discount),
      total: Number(item.total),
      vatRate: Number(item.vatRate ?? 0),
      vatAmount: Number(item.vatAmount ?? 0),
      product: item.product,
      unit: item.unit,
    }));

    // Prepare purchase invoice data for PDF
    const pdfInvoice = {
      invoiceNumber: invoice.purchaseInvoiceNumber,
      issueDate: invoice.invoiceDate,
      supplier: {
        name: invoice.supplier.name,
        arabicName: invoice.supplier.arabicName,
        address: invoice.supplier.address,
        city: invoice.supplier.city,
        state: invoice.supplier.state,
        vatNumber: invoice.supplier.vatNumber,
      },
      organization: {
        name: org?.name ?? "",
        arabicName: org?.arabicName ?? null,
        arabicAddress: org?.arabicAddress ?? null,
        vatNumber: org?.vatNumber ?? null,
      },
      items: pdfItems,
      subtotal: Number(invoice.subtotal),
      totalVat: Number(invoice.totalVat ?? 0),
      roundOffAmount: Number(invoice.roundOffAmount),
      total: Number(invoice.total),
      amountPaid: Number(invoice.amountPaid),
      balanceDue: Number(invoice.balanceDue),
      notes: invoice.notes,
      currency: org?.currency ?? null,
    };

    // Generate PDF using dedicated purchase invoice template
    const pdfBuffer = await renderToBuffer(
      createElement(PurchaseInvoicePDF, {
        invoice: pdfInvoice,
        balanceInfo,
      }) as any
    );

    // Return PDF as response
    const filename = `purchase-invoice-${invoice.purchaseInvoiceNumber}-${format(
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
    console.error("Failed to generate purchase invoice PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate purchase invoice PDF" },
      { status: 500 }
    );
  }
}
