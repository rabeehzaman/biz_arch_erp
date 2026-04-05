import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { generateQRCodeDataURL } from "@/lib/saudi-vat/qr-code";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);

    // Optional: generate QR from invoice qrCodeData passed as query param
    const qrCodeData = request.nextUrl.searchParams.get("qrCodeData");

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        name: true,
        arabicName: true,
        address: true,
        arabicAddress: true,
        city: true,
        arabicCity: true,
        state: true,
        phone: true,
        vatNumber: true,
        gstin: true,
        posReceiptLogoUrl: true,
        pdfHeaderImageUrl: true,
        posReceiptLogoHeight: true,
        brandColor: true,
        currency: true,
        saudiEInvoiceEnabled: true,
        isTaxInclusivePrice: true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    let qrCodeDataURL: string | null = null;
    if (qrCodeData) {
      try {
        qrCodeDataURL = await generateQRCodeDataURL(qrCodeData);
      } catch {
        // QR generation failed — continue without it
      }
    }

    const taxLabel = org.saudiEInvoiceEnabled ? "VAT" : org.gstin ? "GST" : "Tax";

    return NextResponse.json({
      storeName: org.name,
      storeAddress: org.address,
      storeCity: org.city,
      storeState: org.state,
      storePhone: org.phone,
      storeGstin: org.gstin,
      vatNumber: org.vatNumber,
      secondaryName: org.arabicName,
      logoUrl: org.posReceiptLogoUrl || org.pdfHeaderImageUrl,
      logoHeight: org.posReceiptLogoHeight ?? 80,
      brandColor: org.brandColor,
      currency: org.currency || "SAR",
      taxLabel,
      isTaxInclusivePrice: org.isTaxInclusivePrice || false,
      qrCodeDataURL,
    });
  } catch (error) {
    console.error("Failed to fetch receipt meta:", error);
    return NextResponse.json(
      { error: "Failed to fetch receipt metadata" },
      { status: 500 }
    );
  }
}
