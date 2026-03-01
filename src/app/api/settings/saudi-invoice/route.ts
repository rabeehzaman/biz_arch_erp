import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { seedSaudiVATAccounts } from "@/lib/accounting/seed-coa";
import { validateTRN } from "@/lib/saudi-vat/calculator";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        saudiEInvoiceEnabled: true,
        vatNumber: true,
        commercialRegNumber: true,
        arabicName: true,
        arabicAddress: true,
        arabicCity: true,
      },
    });

    // Also fetch PDF format setting
    const pdfFormatSetting = await prisma.setting.findFirst({
      where: { organizationId, key: "invoice_pdf_format" },
    });

    return NextResponse.json({
      ...org,
      invoicePdfFormat: pdfFormatSetting?.value || "A5_LANDSCAPE",
    });
  } catch (error) {
    console.error("Failed to fetch Saudi invoice settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const role = (session.user as { role?: string }).role;
    const body = await request.json();

    const {
      saudiEInvoiceEnabled,
      vatNumber,
      commercialRegNumber,
      arabicName,
      arabicAddress,
      arabicCity,
      invoicePdfFormat,
    } = body;

    // Only admin/superadmin can toggle saudiEInvoiceEnabled
    if (saudiEInvoiceEnabled !== undefined && role !== "admin" && role !== "superadmin") {
      return NextResponse.json({ error: "Only admins can enable/disable Saudi e-invoicing" }, { status: 403 });
    }

    // Validate TRN if provided
    if (vatNumber && vatNumber !== "" && !validateTRN(vatNumber)) {
      return NextResponse.json(
        { error: "Invalid VAT Number (TRN). Must be 15 digits starting with 3." },
        { status: 400 }
      );
    }

    // Mutual exclusivity: cannot have both GST and Saudi enabled
    if (saudiEInvoiceEnabled === true) {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { gstEnabled: true },
      });
      if (org?.gstEnabled) {
        return NextResponse.json(
          { error: "Cannot enable Saudi e-invoicing when GST is enabled. Please disable GST first." },
          { status: 400 }
        );
      }
    }

    // Check if we're enabling Saudi for the first time (to seed VAT accounts)
    let seedVATAccounts = false;
    if (saudiEInvoiceEnabled === true) {
      const current = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { saudiEInvoiceEnabled: true },
      });
      seedVATAccounts = !current?.saudiEInvoiceEnabled;
    }

    // Update organization
    const updateData: Record<string, unknown> = {};
    if (saudiEInvoiceEnabled !== undefined) updateData.saudiEInvoiceEnabled = saudiEInvoiceEnabled;
    if (vatNumber !== undefined) updateData.vatNumber = vatNumber || null;
    if (commercialRegNumber !== undefined) updateData.commercialRegNumber = commercialRegNumber || null;
    if (arabicName !== undefined) updateData.arabicName = arabicName || null;
    if (arabicAddress !== undefined) updateData.arabicAddress = arabicAddress || null;
    if (arabicCity !== undefined) updateData.arabicCity = arabicCity || null;

    await prisma.$transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        await tx.organization.update({
          where: { id: organizationId },
          data: updateData,
        });
      }

      // Seed VAT accounts if enabling for first time
      if (seedVATAccounts) {
        await seedSaudiVATAccounts(tx as unknown as Parameters<typeof seedSaudiVATAccounts>[0], organizationId);
      }

      // Save PDF format setting
      if (invoicePdfFormat !== undefined) {
        await tx.setting.upsert({
          where: { organizationId_key: { organizationId, key: "invoice_pdf_format" } },
          update: { value: invoicePdfFormat },
          create: { organizationId, key: "invoice_pdf_format", value: invoicePdfFormat },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save Saudi invoice settings:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
