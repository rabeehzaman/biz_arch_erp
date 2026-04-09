import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;

    const posSession = await prisma.pOSSession.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!posSession) {
      return NextResponse.json({ error: "POS session not found" }, { status: 404 });
    }

    const [orders, org] = await Promise.all([
      prisma.invoice.findMany({
        where: { posSessionId: id, organizationId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          invoiceNumber: true,
          issueDate: true,
          subtotal: true,
          total: true,
          roundOffAmount: true,
          amountPaid: true,
          totalCgst: true,
          totalSgst: true,
          totalIgst: true,
          totalVat: true,
          qrCodeData: true,
          customer: { select: { name: true } },
          isInterState: true,
          items: {
            select: {
              description: true,
              quantity: true,
              unitPrice: true,
              discount: true,
              total: true,
              gstRate: true,
              cgstRate: true,
              sgstRate: true,
              igstRate: true,
              cgstAmount: true,
              sgstAmount: true,
              igstAmount: true,
              hsnCode: true,
              vatRate: true,
            },
          },
          payments: {
            select: { paymentMethod: true, amount: true },
          },
        },
      }),
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          posReceiptLogoUrl: true,
          logoUrl: true,
          pdfHeaderImageUrl: true,
          posReceiptLogoHeight: true,
          brandColor: true,
          vatNumber: true,
          arabicName: true,
          gstEnabled: true,
          saudiEInvoiceEnabled: true,
          currency: true,
          isTaxInclusivePrice: true,
        },
      }),
    ]);

    let ordersWithQR;
    if (org?.saudiEInvoiceEnabled) {
      // Import once, generate for all orders that have QR data
      const { generateQRCodeDataURL } = await import("@/lib/saudi-vat/qr-code");
      ordersWithQR = await Promise.all(
        orders.map(async (order) => {
          let qrCodeDataURL: string | null = null;
          if (order.qrCodeData) {
            try {
              qrCodeDataURL = await generateQRCodeDataURL(order.qrCodeData);
            } catch {
              // ignore QR generation failure
            }
          }
          return { ...order, qrCodeDataURL };
        })
      );
    } else {
      // Non-Saudi orgs: skip QR generation entirely
      ordersWithQR = orders.map((order) => ({ ...order, qrCodeDataURL: null }));
    }

    const taxLabel = org?.saudiEInvoiceEnabled ? "VAT" : org?.gstEnabled ? "GST" : "Tax";

    return NextResponse.json({
      orders: ordersWithQR,
      receiptMeta: {
        logoUrl: org?.posReceiptLogoUrl || org?.logoUrl || org?.pdfHeaderImageUrl || null,
        logoHeight: org?.posReceiptLogoHeight ?? 80,
        brandColor: org?.brandColor || null,
        vatNumber: org?.vatNumber || null,
        arabicName: org?.arabicName || null,
        taxLabel,
        currency: org?.currency || "INR",
        isTaxInclusivePrice: org?.isTaxInclusivePrice || false,
      },
    });
  } catch (error) {
    console.error("Failed to fetch POS session orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch POS session orders" },
      { status: 500 }
    );
  }
}
