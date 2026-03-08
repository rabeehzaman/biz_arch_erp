import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePDF } from "@/components/pdf/invoice-pdf";
import { InvoiceA4VATPDF } from "@/components/pdf/invoice-pdf-a4-vat";
import { createElement } from "react";
import { format } from "date-fns";
import { generateQRCodeDataURL } from "@/lib/saudi-vat/qr-code";

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

    // Fetch organization and PDF format setting
    const [org, pdfFormatSetting] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true, arabicName: true, arabicAddress: true, vatNumber: true, pdfHeaderImageUrl: true, pdfFooterImageUrl: true },
      }),
      prisma.setting.findFirst({
        where: { organizationId, key: "invoice_pdf_format" },
        select: { value: true },
      }),
    ]);
    const invoicePdfFormat = pdfFormatSetting?.value || "A5_LANDSCAPE";

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
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitCost),
      discount: Number(item.discount),
      total: Number(item.total),
      product: item.product,
    }));

    // Prepare invoice data for PDF
    const pdfInvoice = {
      invoiceNumber: invoice.purchaseInvoiceNumber,
      issueDate: invoice.invoiceDate,
      customer: {
        name: invoice.supplier.name,
        address: invoice.supplier.address,
        city: invoice.supplier.city,
        state: invoice.supplier.state,
      },
      items: pdfItems,
      subtotal: Number(invoice.subtotal),
      totalCgst: Number(invoice.totalCgst),
      totalSgst: Number(invoice.totalSgst),
      totalIgst: Number(invoice.totalIgst),
      total: Number(invoice.total),
    };

    // Generate QR code image for Saudi invoices
    let qrCodeDataURL: string | undefined;
    if ((invoice as any).qrCodeData) {
      try {
        qrCodeDataURL = await generateQRCodeDataURL((invoice as any).qrCodeData);
      } catch {
        // QR code generation failure is non-fatal
      }
    }

    // Generate PDF
    let pdfBuffer: Buffer;

    if (invoicePdfFormat === "A4_VAT") {
      const vatItems = invoice.items.map((item) => ({
        description: item.description,
        arabicName: item.product?.arabicName ?? null,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitCost),
        discount: Number(item.discount),
        total: Number(item.total),
        vatRate: Number((item as any).vatRate ?? 0),
        vatAmount: Number((item as any).vatAmount ?? 0),
        product: item.product,
        unit: null as any,
      }));

      const vatInvoice = {
        invoiceNumber: invoice.purchaseInvoiceNumber,
        issueDate: invoice.invoiceDate,
        customer: {
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
        items: vatItems,
        subtotal: Number(invoice.subtotal),
        totalVat: Number((invoice as any).totalVat ?? 0),
        total: Number(invoice.total),
        amountPaid: 0,
        balanceDue: Number(invoice.total),
        notes: null,
        terms: null,
        createdByName: null,
        qrCodeDataURL,
        saudiInvoiceType: undefined as string | undefined,
      };

       
      pdfBuffer = await renderToBuffer(
        createElement(InvoiceA4VATPDF, {
          invoice: vatInvoice,
          type: "PURCHASE",
          balanceInfo,
          headerImageUrl: org?.pdfHeaderImageUrl ?? undefined,
          footerImageUrl: org?.pdfFooterImageUrl ?? undefined,
        }) as any
      );
    } else {
       
      pdfBuffer = await renderToBuffer(
        createElement(InvoicePDF, {
          invoice: pdfInvoice,
          type: "PURCHASE",
          balanceInfo,
          lang: (session.user as { language?: string }).language || "en",
        }) as any
      );
    }

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
