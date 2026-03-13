import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { seedGSTAccounts, seedSaudiVATAccounts, seedSaudiStandardAccounts, seedPOSClearingAccounts } from "@/lib/accounting/seed-coa";
import { validateTRN } from "@/lib/saudi-vat/calculator";
import { provisionPOSRegisterSetup } from "@/lib/pos/store-safe";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        users: {
          select: { id: true, name: true, email: true, role: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: { users: true, customers: true, suppliers: true, invoices: true, products: true },
        },
      },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const pdfFormatSetting = await prisma.setting.findFirst({
      where: { organizationId: id, key: "invoice_pdf_format" },
    });

    return NextResponse.json({
      ...organization,
      invoicePdfFormat: pdfFormatSetting?.value || "A5_LANDSCAPE",
    });
  } catch (error) {
    console.error("Failed to fetch organization:", error);
    return NextResponse.json(
      { error: "Failed to fetch organization" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      name,
      slug,
      gstEnabled,
      eInvoicingEnabled,
      multiUnitEnabled,
      multiBranchEnabled,
      isMobileShopModuleEnabled,
      isWeighMachineEnabled,
      weighMachineBarcodePrefix,
      weighMachineProductCodeLen,
      weighMachineWeightDigits,
      weighMachineDecimalPlaces,
      gstin,
      gstStateCode,
      saudiEInvoiceEnabled,
      vatNumber,
      commercialRegNumber,
      arabicName,
      arabicAddress,
      arabicCity,
      invoicePdfFormat,
      language,
      currency,
      pdfHeaderImageUrl,
      pdfFooterImageUrl,
      brandColor,
      invoiceLogoHeight,
      posReceiptLogoUrl,
      posReceiptLogoHeight,
      posAccountingMode,
      posDefaultCashAccountId,
      posDefaultBankAccountId,
      isTaxInclusivePrice,
    } = body;

    // Basic field update validation
    if (slug && !/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: "Slug must contain only lowercase letters, numbers, and hyphens" },
        { status: 400 }
      );
    }

    // Validate language
    if (language !== undefined && !["en", "ar"].includes(language)) {
      return NextResponse.json(
        { error: "Language must be 'en' or 'ar'" },
        { status: 400 }
      );
    }

    // Validate currency
    if (currency !== undefined && !["INR", "SAR"].includes(currency)) {
      return NextResponse.json(
        { error: "Currency must be 'INR' or 'SAR'" },
        { status: 400 }
      );
    }

    // Validate brand color
    if (brandColor && !/^#[0-9a-fA-F]{6}$/.test(brandColor)) {
      return NextResponse.json(
        { error: "Brand color must be a valid hex color (e.g. #2a3b38)" },
        { status: 400 }
      );
    }

    // Validate POS accounting mode
    if (posAccountingMode !== undefined && !["DIRECT", "CLEARING_ACCOUNT"].includes(posAccountingMode)) {
      return NextResponse.json(
        { error: "POS accounting mode must be 'DIRECT' or 'CLEARING_ACCOUNT'" },
        { status: 400 }
      );
    }

    // Check slug uniqueness if changing
    if (slug) {
      const existing = await prisma.organization.findFirst({
        where: { slug, id: { not: id } },
      });
      if (existing) {
        return NextResponse.json(
          { error: "An organization with this slug already exists" },
          { status: 409 }
        );
      }
    }

    // GST validation
    if (gstEnabled && gstin) {
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(gstin)) {
        return NextResponse.json(
          { error: "Invalid GSTIN format" },
          { status: 400 }
        );
      }
    }

    if (eInvoicingEnabled && !gstEnabled) {
      return NextResponse.json(
        { error: "GST must be enabled before enabling e-invoicing" },
        { status: 400 }
      );
    }

    // Saudi validation
    if (saudiEInvoiceEnabled && gstEnabled) {
      return NextResponse.json(
        { error: "Cannot enable both GST and Saudi E-Invoice simultaneously" },
        { status: 400 }
      );
    }

    if (saudiEInvoiceEnabled && vatNumber && !validateTRN(vatNumber)) {
      return NextResponse.json(
        { error: "Invalid VAT Number (TRN). Must be 15 digits starting with 3." },
        { status: 400 }
      );
    }

    // Check if enabling Saudi for the first time (to seed VAT accounts)
    let seedVATAccounts = false;
    if (saudiEInvoiceEnabled === true) {
      const current = await prisma.organization.findUnique({
        where: { id },
        select: { saudiEInvoiceEnabled: true },
      });
      seedVATAccounts = !current?.saudiEInvoiceEnabled;
    }

    // Validate POS default settlement account IDs
    if (posDefaultCashAccountId) {
      const cashAcct = await prisma.cashBankAccount.findFirst({
        where: { id: posDefaultCashAccountId, organizationId: id, isActive: true, accountSubType: "CASH" },
        select: { id: true },
      });
      if (!cashAcct) {
        return NextResponse.json(
          { error: "Selected default cash account is invalid, inactive, or not a CASH account" },
          { status: 400 }
        );
      }
    }
    if (posDefaultBankAccountId) {
      const bankAcct = await prisma.cashBankAccount.findFirst({
        where: { id: posDefaultBankAccountId, organizationId: id, isActive: true, accountSubType: "BANK" },
        select: { id: true },
      });
      if (!bankAcct) {
        return NextResponse.json(
          { error: "Selected default bank account is invalid, inactive, or not a BANK account" },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (gstEnabled !== undefined) updateData.gstEnabled = gstEnabled;
    if (eInvoicingEnabled !== undefined) updateData.eInvoicingEnabled = gstEnabled ? eInvoicingEnabled : false;
    if (multiUnitEnabled !== undefined) updateData.multiUnitEnabled = multiUnitEnabled;
    if (multiBranchEnabled !== undefined) updateData.multiBranchEnabled = multiBranchEnabled;
    if (isMobileShopModuleEnabled !== undefined) updateData.isMobileShopModuleEnabled = isMobileShopModuleEnabled;
    if (isWeighMachineEnabled !== undefined) updateData.isWeighMachineEnabled = isWeighMachineEnabled;
    if (weighMachineBarcodePrefix !== undefined) updateData.weighMachineBarcodePrefix = weighMachineBarcodePrefix || "77";
    if (weighMachineProductCodeLen !== undefined) updateData.weighMachineProductCodeLen = Number(weighMachineProductCodeLen) || 5;
    if (weighMachineWeightDigits !== undefined) updateData.weighMachineWeightDigits = Number(weighMachineWeightDigits) || 5;
    if (weighMachineDecimalPlaces !== undefined) updateData.weighMachineDecimalPlaces = Number(weighMachineDecimalPlaces) || 3;
    if (gstin !== undefined) updateData.gstin = gstin || null;
    if (gstStateCode !== undefined) updateData.gstStateCode = gstStateCode || null;

    // Auto-derive state code from GSTIN
    if (gstin && gstin.length >= 2 && gstEnabled) {
      updateData.gstStateCode = gstin.substring(0, 2);
    }

    if (saudiEInvoiceEnabled !== undefined) updateData.saudiEInvoiceEnabled = saudiEInvoiceEnabled;
    if (vatNumber !== undefined) updateData.vatNumber = vatNumber || null;
    if (commercialRegNumber !== undefined) updateData.commercialRegNumber = commercialRegNumber || null;
    if (arabicName !== undefined) updateData.arabicName = arabicName || null;
    if (arabicAddress !== undefined) updateData.arabicAddress = arabicAddress || null;
    if (arabicCity !== undefined) updateData.arabicCity = arabicCity || null;
    if (language !== undefined) updateData.language = language;
    if (currency !== undefined) updateData.currency = currency;
    if (pdfHeaderImageUrl !== undefined) updateData.pdfHeaderImageUrl = pdfHeaderImageUrl || null;
    if (pdfFooterImageUrl !== undefined) updateData.pdfFooterImageUrl = pdfFooterImageUrl || null;
    if (brandColor !== undefined) updateData.brandColor = brandColor || null;
    if (invoiceLogoHeight !== undefined) updateData.invoiceLogoHeight = Number(invoiceLogoHeight) || 60;
    if (posReceiptLogoUrl !== undefined) updateData.posReceiptLogoUrl = posReceiptLogoUrl || null;
    if (posReceiptLogoHeight !== undefined) updateData.posReceiptLogoHeight = Number(posReceiptLogoHeight) || 80;
    if (posAccountingMode !== undefined) updateData.posAccountingMode = posAccountingMode;
    if (posDefaultCashAccountId !== undefined) updateData.posDefaultCashAccountId = posDefaultCashAccountId || null;
    if (posDefaultBankAccountId !== undefined) updateData.posDefaultBankAccountId = posDefaultBankAccountId || null;
    if (isTaxInclusivePrice !== undefined) updateData.isTaxInclusivePrice = isTaxInclusivePrice;

    const organization = await prisma.$transaction(
      async (tx) => {
        const org = await tx.organization.update({
          where: { id },
          data: updateData,
        });

        // Seed GST accounts if enabling GST
        if (gstEnabled) {
          await seedGSTAccounts(tx as never, id);
        }

        // Seed Saudi VAT accounts if enabling Saudi for first time
        if (seedVATAccounts) {
          await seedSaudiVATAccounts(tx as never, id);
          await seedSaudiStandardAccounts(tx as never, id);
        }

        // Keep POS clearing accounts aligned with the Cash subtree whenever clearing mode is active.
        if (org.posAccountingMode === "CLEARING_ACCOUNT") {
          await seedPOSClearingAccounts(tx as never, id);
        }

        // Upsert invoice PDF format setting
        if (invoicePdfFormat !== undefined) {
          await tx.setting.upsert({
            where: { organizationId_key: { organizationId: id, key: "invoice_pdf_format" } },
            update: { value: invoicePdfFormat },
            create: { organizationId: id, key: "invoice_pdf_format", value: invoicePdfFormat },
          });
        }

        // Seed default branch + warehouse when enabling multi-branch
        if (multiBranchEnabled) {
          const existingBranch = await tx.branch.findFirst({
            where: { organizationId: id },
          });

          if (!existingBranch) {
            const branch = await tx.branch.create({
              data: {
                organizationId: id,
                name: "Head Office",
                code: "HO",
                isActive: true,
              },
            });

            const warehouse = await tx.warehouse.create({
              data: {
                organizationId: id,
                branchId: branch.id,
                name: "Main Warehouse",
                code: "MW",
                isActive: true,
                isDefault: true,
              },
            });

            // Grant all existing users access to the default warehouse
            const orgUsers = await tx.user.findMany({
              where: { organizationId: id },
              select: { id: true },
            });

            if (orgUsers.length > 0) {
              await tx.userWarehouseAccess.createMany({
                data: orgUsers.map((u) => ({
                  userId: u.id,
                  branchId: branch.id,
                  warehouseId: warehouse.id,
                  isDefault: true,
                  organizationId: id,
                })),
                skipDuplicates: true,
              });
            }
          }

          // Migrate existing NULL-warehouse/branch records to the first (oldest) warehouse
          const targetWarehouse = await tx.warehouse.findFirst({
            where: { organizationId: id, isActive: true },
            orderBy: { createdAt: "asc" },
            select: { id: true, branchId: true },
          });

          if (targetWarehouse) {
            await tx.stockLot.updateMany({
              where: { organizationId: id, warehouseId: null },
              data: { warehouseId: targetWarehouse.id },
            });

            await tx.openingStock.updateMany({
              where: { organizationId: id, warehouseId: null },
              data: { warehouseId: targetWarehouse.id },
            });

            await tx.invoice.updateMany({
              where: { organizationId: id, branchId: null },
              data: { branchId: targetWarehouse.branchId },
            });
            await tx.invoice.updateMany({
              where: { organizationId: id, warehouseId: null },
              data: { warehouseId: targetWarehouse.id },
            });

            await tx.purchaseInvoice.updateMany({
              where: { organizationId: id, branchId: null },
              data: { branchId: targetWarehouse.branchId },
            });
            await tx.purchaseInvoice.updateMany({
              where: { organizationId: id, warehouseId: null },
              data: { warehouseId: targetWarehouse.id },
            });
          }
        }

        if (org.posAccountingMode === "CLEARING_ACCOUNT" || org.multiBranchEnabled) {
          await provisionPOSRegisterSetup(tx as never, id);
        }

        return org;
      },
      {
        maxWait: 20000, // Wait up to 20s to acquire a connection (Neon cold start)
        timeout: 60000, // Allow 60s for all queries inside the transaction
      }
    );

    return NextResponse.json(organization);
  } catch (error) {
    console.error("Failed to update organization:", error);
    return NextResponse.json(
      { error: "Failed to update organization" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Check if org has any data
    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true, invoices: true, customers: true },
        },
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (org._count.invoices > 0 || org._count.customers > 0) {
      return NextResponse.json(
        { error: "Cannot delete organization with existing data. Remove all customers and invoices first." },
        { status: 400 }
      );
    }

    // Delete users first, then org
    await prisma.user.deleteMany({ where: { organizationId: id } });
    await prisma.setting.deleteMany({ where: { organizationId: id } });
    await prisma.unit.deleteMany({ where: { organizationId: id } });
    await prisma.organization.delete({ where: { id } });

    return NextResponse.json({ message: "Organization deleted" });
  } catch (error) {
    console.error("Failed to delete organization:", error);
    return NextResponse.json(
      { error: "Failed to delete organization" },
      { status: 500 }
    );
  }
}
