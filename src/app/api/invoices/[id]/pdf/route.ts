import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePDF } from "@/components/pdf/invoice-pdf-a5";
import { InvoiceA4PDF } from "@/components/pdf/invoice-pdf-a4";
import { InvoiceA4GST2PDF } from "@/components/pdf/invoice-pdf-a4-gst2";
import { InvoiceA4VATPDF } from "@/components/pdf/invoice-pdf-a4-vat";
import { InvoiceBilingualPDF } from "@/components/pdf/invoice-pdf-bilingual";
import { InvoiceModernGSTPDF } from "@/components/pdf/invoice-pdf-modern-gst";
import { JewelleryInvoicePDF } from "@/components/pdf/invoice-pdf-jewellery";
import { createElement } from "react";
import { format } from "date-fns";
import { generateQRCodeDataURL } from "@/lib/saudi-vat/qr-code";
import { getEditionConfig } from "@/lib/edition";

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

    // Fetch organization and PDF format settings
    const [org, pdfFormatSetting, assignedTemplatesSetting] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true, address: true, phone: true, gstEnabled: true, gstin: true, gstStateCode: true, pdfHeaderImageUrl: true, pdfFooterImageUrl: true, logoUrl: true, arabicName: true, arabicAddress: true, vatNumber: true, commercialRegNumber: true, saudiEInvoiceEnabled: true, currency: true, brandColor: true, edition: true },
      }),
      prisma.setting.findFirst({
        where: { organizationId, key: "invoice_pdf_format", userId: null },
        select: { value: true },
      }),
      prisma.setting.findFirst({
        where: { organizationId, key: "assigned_invoice_templates", userId: null },
        select: { value: true },
      }),
    ]);

    // Build valid templates from assigned list, falling back to edition defaults
    let validTemplates: string[] = [];
    try { validTemplates = assignedTemplatesSetting ? JSON.parse(assignedTemplatesSetting.value) : []; } catch { /* ignore */ }
    if (validTemplates.length === 0) {
      validTemplates = [...getEditionConfig(org?.edition).allowedInvoicePdfFormats];
    }

    const templateOverride = request.nextUrl.searchParams.get("template");
    const invoicePdfFormat = (templateOverride && validTemplates.includes(templateOverride)) ? templateOverride : (pdfFormatSetting?.value || "A5_LANDSCAPE");

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
            gstin: true,
            gstStateCode: true,
            arabicName: true,
            vatNumber: true,
            zipCode: true,
            country: true,
            ccNo: true,
            buildingNo: true,
            addNo: true,
            district: true,
            phone: true,
          },
        },
        createdBy: {
          select: { name: true },
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
      unit: item.unit,
    }));

    // Generate QR code image for Saudi invoices
    let qrCodeDataURL: string | undefined;
    if (invoice.qrCodeData) {
      try {
        qrCodeDataURL = await generateQRCodeDataURL(invoice.qrCodeData);
      } catch {
        // QR code generation failure is non-fatal
      }
    }

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
      roundOffAmount: Number(invoice.roundOffAmount),
      total: Number(invoice.total),
      // Saudi fields
      saudiInvoiceType: invoice.saudiInvoiceType ?? undefined,
      totalVat: invoice.totalVat ? Number(invoice.totalVat) : undefined,
      qrCodeDataURL,
      paymentType: invoice.paymentType,
    };

    // Generate PDF — use A4 portrait template when configured
    let pdfBuffer: Buffer;

    // Auto-use jewellery template for jewellery sales
    if (invoice.isJewellerySale) {
      const jwItems = invoice.items.map((item) => ({
        tagNumber: item.tagNumber,
        huidNumber: item.huidNumber,
        purity: item.purity,
        metalType: item.metalType,
        grossWeight: Number(item.grossWeight || 0),
        netWeight: Number(item.netWeight || 0),
        fineWeight: Number(item.fineWeight || 0),
        goldRate: Number(item.goldRate || 0),
        wastagePercent: Number(item.wastagePercent || 0),
        makingChargeType: item.makingChargeType,
        makingChargeValue: Number(item.makingChargeValue || 0),
        stoneValue: Number(item.stoneValue || 0),
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
        description: item.description,
      }));

      const jwInvoice = {
        invoiceNumber: invoice.invoiceNumber,
        issueDate: invoice.issueDate,
        customer: {
          name: invoice.customer.name,
          address: invoice.customer.address,
          city: invoice.customer.city,
          state: invoice.customer.state,
          gstin: invoice.customer.gstin,
          phone: invoice.customer.phone,
        },
        organization: {
          name: org?.name ?? "",
          address: org?.address ?? null,
          gstin: org?.gstin ?? null,
          vatNumber: org?.vatNumber ?? null,
          phone: org?.phone ?? null,
        },
        items: jwItems,
        subtotal: Number(invoice.subtotal),
        totalCgst: Number(invoice.totalCgst),
        totalSgst: Number(invoice.totalSgst),
        totalIgst: Number(invoice.totalIgst),
        totalVat: invoice.totalVat ? Number(invoice.totalVat) : undefined,
        roundOffAmount: Number(invoice.roundOffAmount),
        total: Number(invoice.total),
        amountPaid: Number(invoice.amountPaid),
        balanceDue: Number(invoice.balanceDue),
        notes: invoice.notes,
        paymentType: invoice.paymentType,
      };

      pdfBuffer = await renderToBuffer(
        createElement(JewelleryInvoicePDF, {
          invoice: jwInvoice,
          currencySymbol: org?.currency === "SAR" ? "﷼" : "₹",
          currency: org?.currency ?? "INR",
          headerImageUrl: (org?.logoUrl || org?.pdfHeaderImageUrl) ?? undefined,
        }) as any
      );
    } else if (invoicePdfFormat === "A4_VAT") {
      const vatItems = invoice.items.map((item) => ({
        description: item.description,
        arabicName: item.product?.arabicName ?? null,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        total: Number(item.total),
        vatRate: Number(item.vatRate ?? 0),
        vatAmount: Number(item.vatAmount ?? 0),
        product: item.product,
        unit: item.unit,
      }));

      const vatInvoice = {
        invoiceNumber: invoice.invoiceNumber,
        issueDate: invoice.issueDate,
        customer: {
          name: invoice.customer.name,
          arabicName: invoice.customer.arabicName,
          address: invoice.customer.address,
          city: invoice.customer.city,
          state: invoice.customer.state,
          vatNumber: invoice.customer.vatNumber,
        },
        organization: {
          name: org?.name ?? "",
          arabicName: org?.arabicName ?? null,
          arabicAddress: org?.arabicAddress ?? null,
          vatNumber: org?.vatNumber ?? null,
        },
        items: vatItems,
        subtotal: Number(invoice.subtotal),
        totalVat: Number(invoice.totalVat ?? 0),
        roundOffAmount: Number(invoice.roundOffAmount),
        total: Number(invoice.total),
        amountPaid: Number(invoice.amountPaid),
        balanceDue: Number(invoice.balanceDue),
        notes: invoice.notes,
        terms: invoice.terms,
        createdByName: invoice.createdBy?.name ?? null,
        qrCodeDataURL,
        saudiInvoiceType: invoice.saudiInvoiceType ?? undefined,
        paymentType: invoice.paymentType,
      };

       
      pdfBuffer = await renderToBuffer(
        createElement(InvoiceA4VATPDF, {
          invoice: vatInvoice,
          type: "SALES",
          balanceInfo,
          headerImageUrl: org?.pdfHeaderImageUrl ?? undefined,
          footerImageUrl: org?.pdfFooterImageUrl ?? undefined,
        }) as any
      );
    } else if (invoicePdfFormat === "A4_BILINGUAL") {
      const bilingualItems = invoice.items.map((item) => ({
        description: item.description,
        arabicName: item.product?.arabicName ?? null,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        total: Number(item.total),
        vatRate: Number(item.vatRate ?? 15),
        vatAmount: Number(item.vatAmount ?? 0),
        product: item.product,
        unit: item.unit,
      }));

      const bilingualInvoice = {
        invoiceNumber: invoice.invoiceNumber,
        issueDate: invoice.issueDate,
        customer: {
          name: invoice.customer.name,
          arabicName: invoice.customer.arabicName,
          address: invoice.customer.address,
          city: invoice.customer.city,
          state: invoice.customer.state,
          vatNumber: invoice.customer.vatNumber,
          zipCode: invoice.customer.zipCode,
          country: invoice.customer.country,
          ccNo: invoice.customer.ccNo,
          buildingNo: invoice.customer.buildingNo,
          addNo: invoice.customer.addNo,
          district: invoice.customer.district,
        },
        organization: {
          name: org?.name ?? "",
          arabicName: org?.arabicName ?? null,
          arabicAddress: org?.arabicAddress ?? null,
          vatNumber: org?.vatNumber ?? null,
          commercialRegNumber: org?.commercialRegNumber ?? null,
        },
        items: bilingualItems,
        subtotal: Number(invoice.subtotal),
        totalVat: Number(invoice.totalVat ?? 0),
        roundOffAmount: Number(invoice.roundOffAmount),
        total: Number(invoice.total),
        amountPaid: Number(invoice.amountPaid),
        balanceDue: Number(invoice.balanceDue),
        qrCodeDataURL,
        saudiInvoiceType: invoice.saudiInvoiceType ?? undefined,
        paymentType: invoice.paymentType,
      };

       
      pdfBuffer = await renderToBuffer(
        createElement(InvoiceBilingualPDF, {
          invoice: bilingualInvoice,
          type: "SALES",
          title: "Tax Invoice",
          headerImageUrl: org?.pdfHeaderImageUrl ?? undefined,
          footerImageUrl: org?.pdfFooterImageUrl ?? undefined,
          brandColor: org?.brandColor ?? undefined,
        }) as any
      );
    } else if (invoicePdfFormat === "A4_PORTRAIT" || invoicePdfFormat === "A4_GST2") {
      const a4Items = invoice.items.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        total: Number(item.total),
        hsnCode: item.hsnCode,
        gstRate: Number(item.gstRate),
        cgstRate: Number(item.cgstRate),
        sgstRate: Number(item.sgstRate),
        igstRate: Number(item.igstRate),
        cgstAmount: Number(item.cgstAmount),
        sgstAmount: Number(item.sgstAmount),
        igstAmount: Number(item.igstAmount),
        product: item.product,
        unit: item.unit,
      }));

      const a4Invoice = {
        invoiceNumber: invoice.invoiceNumber,
        issueDate: invoice.issueDate,
        customer: {
          name: invoice.customer.name,
          address: invoice.customer.address,
          city: invoice.customer.city,
          state: invoice.customer.state,
          gstin: invoice.customer.gstin,
        },
        organization: { name: org?.name ?? "", gstin: org?.gstin ?? null },
        items: a4Items,
        subtotal: Number(invoice.subtotal),
        totalCgst: Number(invoice.totalCgst),
        totalSgst: Number(invoice.totalSgst),
        totalIgst: Number(invoice.totalIgst),
        roundOffAmount: Number(invoice.roundOffAmount),
        total: Number(invoice.total),
        amountPaid: Number(invoice.amountPaid),
        balanceDue: Number(invoice.balanceDue),
        isInterState: invoice.isInterState,
        placeOfSupply: invoice.placeOfSupply,
        notes: invoice.notes,
        terms: invoice.terms,
        createdByName: invoice.createdBy?.name ?? null,
        paymentType: invoice.paymentType,
      };

      const A4Component = invoicePdfFormat === "A4_GST2" ? InvoiceA4GST2PDF : InvoiceA4PDF;
       
      pdfBuffer = await renderToBuffer(
        createElement(A4Component, {
          invoice: a4Invoice,
          type: "SALES",
          balanceInfo,
          headerImageUrl: org?.pdfHeaderImageUrl ?? undefined,
          footerImageUrl: org?.pdfFooterImageUrl ?? undefined,
        }) as any
      );
    } else if (invoicePdfFormat === "A4_MODERN_GST") {
      const taxMode = org?.saudiEInvoiceEnabled ? "VAT" : org?.gstEnabled ? "GST" : "NONE";
      const currencySymbol = org?.currency === "SAR" ? "SAR " : "\u20B9";

      const modernItems = invoice.items.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        total: Number(item.total),
        hsnCode: item.hsnCode,
        gstRate: Number(item.gstRate),
        cgstRate: Number(item.cgstRate),
        sgstRate: Number(item.sgstRate),
        igstRate: Number(item.igstRate),
        cgstAmount: Number(item.cgstAmount),
        sgstAmount: Number(item.sgstAmount),
        igstAmount: Number(item.igstAmount),
        vatRate: Number(item.vatRate ?? 0),
        vatAmount: Number(item.vatAmount ?? 0),
        product: item.product,
        unit: item.unit,
      }));

      const modernInvoice = {
        invoiceNumber: invoice.invoiceNumber,
        issueDate: invoice.issueDate,
        customer: {
          name: invoice.customer.name,
          address: invoice.customer.address,
          city: invoice.customer.city,
          state: invoice.customer.state,
          gstin: invoice.customer.gstin,
          vatNumber: invoice.customer.vatNumber,
        },
        organization: {
          name: org?.name ?? "",
          gstin: org?.gstin ?? null,
          vatNumber: org?.vatNumber ?? null,
        },
        items: modernItems,
        subtotal: Number(invoice.subtotal),
        totalCgst: Number(invoice.totalCgst),
        totalSgst: Number(invoice.totalSgst),
        totalIgst: Number(invoice.totalIgst),
        totalVat: invoice.totalVat ? Number(invoice.totalVat) : undefined,
        roundOffAmount: Number(invoice.roundOffAmount),
        total: Number(invoice.total),
        amountPaid: Number(invoice.amountPaid),
        balanceDue: Number(invoice.balanceDue),
        isInterState: invoice.isInterState,
        placeOfSupply: invoice.placeOfSupply,
        notes: invoice.notes,
        terms: invoice.terms,
        paymentType: invoice.paymentType,
      };

       
      pdfBuffer = await renderToBuffer(
        createElement(InvoiceModernGSTPDF, {
          invoice: modernInvoice,
          type: "SALES",
          taxMode,
          currencySymbol,
          currency: org?.currency || "INR",
          brandColor: org?.brandColor ?? undefined,
          headerImageUrl: (org?.logoUrl || org?.pdfHeaderImageUrl) ?? undefined,
        }) as any
      );
    } else {
       
      pdfBuffer = await renderToBuffer(
        createElement(InvoicePDF, {
          invoice: pdfInvoice,
          type: "SALES",
          balanceInfo,
          lang: (session.user as { language?: string }).language || "en",
        }) as any
      );
    }

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
