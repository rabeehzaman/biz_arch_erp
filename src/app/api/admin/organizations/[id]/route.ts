import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { seedGSTAccounts, seedSaudiVATAccounts, seedSaudiStandardAccounts, seedPOSClearingAccounts, seedJewelleryAccounts } from "@/lib/accounting/seed-coa";
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

    const [pdfFormatSetting, transferPdfFormatSetting, transferHideCostSetting] = await Promise.all([
      prisma.setting.findFirst({ where: { organizationId: id, key: "invoice_pdf_format", userId: null } }),
      prisma.setting.findFirst({ where: { organizationId: id, key: "transfer_pdf_format", userId: null } }),
      prisma.setting.findFirst({ where: { organizationId: id, key: "transfer_pdf_hide_cost", userId: null } }),
    ]);

    return NextResponse.json({
      ...organization,
      invoicePdfFormat: pdfFormatSetting?.value || "A5_LANDSCAPE",
      transferPdfFormat: transferPdfFormatSetting?.value || "DEFAULT",
      transferPdfHideCost: transferHideCostSetting?.value === "true",
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
      edition,
      gstEnabled,
      eInvoicingEnabled,
      multiUnitEnabled,
      multiBranchEnabled,
      isScannerEnabled,
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
      transferPdfFormat,
      transferPdfHideCost,
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
      isJewelleryModuleEnabled,
      jewelleryHuidMandatory,
      jewellerySasoMandatory,
      jewelleryConsignmentEnabled,
      jewellerySchemesEnabled,
      jewelleryOldGoldEnabled,
      jewelleryRepairsEnabled,
      jewelleryKarigarsEnabled,
      jewelleryGoldTaxRate,
      jewelleryMakingChargeTaxRate,
      jewelleryStoneTaxRate,
      jewelleryInvestmentGoldTaxRate,
      jewelleryPanRequired,
      jewelleryPanThreshold,
      jewelleryCashLimitEnabled,
      jewelleryCashLimitAmount,
      jewelleryTcsEnabled,
      jewelleryTcsRate,
      jewelleryTcsThreshold,
      jewelleryDefaultWastagePercent,
      jewelleryKarigarWastageTolerance,
      jewelleryWeightTolerance,
      jewelleryBuyRateSpread,
      jewelleryAutoDerivePurities,
      jewelleryAgingAlertDays,
      jewelleryReconciliationTolerance,
      jewelleryDefaultMakingChargeType,
      jewellerySchemeMaxDuration,
      jewellerySchemeBonusMonths,
      jewellerySchemeEnforce365Days,
      jewellerySchemeRedemptionDiscount,
      jewelleryThemeEnabled,
      jewelleryThemeColor,
      jewelleryThemePreset,
      jewelleryEnabledPurities,
      jewelleryEnabledMetals,
      isRestaurantModuleEnabled,
      restaurantTablesEnabled,
      restaurantKotPrintingEnabled,
      restaurantThemeEnabled,
      restaurantThemeColor,
      restaurantThemePreset,
      address,
      city,
      state,
      zipCode,
      country,
      phone,
      email: companyEmail,
      bankName,
      bankAccountNumber,
      bankIfscCode,
      bankBranch,
      roundOffMode,
    } = body;

    // Validate edition
    if (edition !== undefined && !["INDIA", "SAUDI"].includes(edition)) {
      return NextResponse.json(
        { error: "Edition must be 'INDIA' or 'SAUDI'" },
        { status: 400 }
      );
    }

    // Edition-based flag validation
    if (edition === "INDIA" && saudiEInvoiceEnabled === true) {
      return NextResponse.json(
        { error: "Cannot enable Saudi E-Invoice for India edition" },
        { status: 400 }
      );
    }
    if (edition === "SAUDI" && gstEnabled === true) {
      return NextResponse.json(
        { error: "Cannot enable GST for Saudi edition" },
        { status: 400 }
      );
    }

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

    // Validate round-off mode
    if (roundOffMode !== undefined && !["NONE", "NEAREST", "UP", "DOWN"].includes(roundOffMode)) {
      return NextResponse.json(
        { error: "Round-off mode must be 'NONE', 'NEAREST', 'UP', or 'DOWN'" },
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
    if (edition !== undefined) updateData.edition = edition;
    if (gstEnabled !== undefined) updateData.gstEnabled = gstEnabled;
    if (eInvoicingEnabled !== undefined) updateData.eInvoicingEnabled = gstEnabled ? eInvoicingEnabled : false;
    if (multiUnitEnabled !== undefined) updateData.multiUnitEnabled = multiUnitEnabled;
    if (multiBranchEnabled !== undefined) updateData.multiBranchEnabled = multiBranchEnabled;
    if (isScannerEnabled !== undefined) updateData.isScannerEnabled = isScannerEnabled;
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

    // Company details
    if (address !== undefined) updateData.address = address || null;
    if (city !== undefined) updateData.city = city || null;
    if (state !== undefined) updateData.state = state || null;
    if (zipCode !== undefined) updateData.zipCode = zipCode || null;
    if (country !== undefined) updateData.country = country || null;
    if (phone !== undefined) updateData.phone = phone || null;
    if (companyEmail !== undefined) updateData.email = companyEmail || null;
    if (bankName !== undefined) updateData.bankName = bankName || null;
    if (bankAccountNumber !== undefined) updateData.bankAccountNumber = bankAccountNumber || null;
    if (bankIfscCode !== undefined) updateData.bankIfscCode = bankIfscCode || null;
    if (bankBranch !== undefined) updateData.bankBranch = bankBranch || null;
    if (roundOffMode !== undefined) updateData.roundOffMode = roundOffMode;

    // Jewellery module settings
    if (isJewelleryModuleEnabled !== undefined) updateData.isJewelleryModuleEnabled = isJewelleryModuleEnabled;
    if (jewelleryHuidMandatory !== undefined) updateData.jewelleryHuidMandatory = jewelleryHuidMandatory;
    if (jewellerySasoMandatory !== undefined) updateData.jewellerySasoMandatory = jewellerySasoMandatory;
    if (jewelleryConsignmentEnabled !== undefined) updateData.jewelleryConsignmentEnabled = jewelleryConsignmentEnabled;
    if (jewellerySchemesEnabled !== undefined) updateData.jewellerySchemesEnabled = jewellerySchemesEnabled;
    if (jewelleryOldGoldEnabled !== undefined) updateData.jewelleryOldGoldEnabled = jewelleryOldGoldEnabled;
    if (jewelleryRepairsEnabled !== undefined) updateData.jewelleryRepairsEnabled = jewelleryRepairsEnabled;
    if (jewelleryKarigarsEnabled !== undefined) updateData.jewelleryKarigarsEnabled = jewelleryKarigarsEnabled;
    if (jewelleryGoldTaxRate !== undefined) updateData.jewelleryGoldTaxRate = Number(jewelleryGoldTaxRate);
    if (jewelleryMakingChargeTaxRate !== undefined) updateData.jewelleryMakingChargeTaxRate = Number(jewelleryMakingChargeTaxRate);
    if (jewelleryStoneTaxRate !== undefined) updateData.jewelleryStoneTaxRate = Number(jewelleryStoneTaxRate);
    if (jewelleryInvestmentGoldTaxRate !== undefined) updateData.jewelleryInvestmentGoldTaxRate = Number(jewelleryInvestmentGoldTaxRate);
    if (jewelleryPanRequired !== undefined) updateData.jewelleryPanRequired = jewelleryPanRequired;
    if (jewelleryPanThreshold !== undefined) updateData.jewelleryPanThreshold = Number(jewelleryPanThreshold);
    if (jewelleryCashLimitEnabled !== undefined) updateData.jewelleryCashLimitEnabled = jewelleryCashLimitEnabled;
    if (jewelleryCashLimitAmount !== undefined) updateData.jewelleryCashLimitAmount = Number(jewelleryCashLimitAmount);
    if (jewelleryTcsEnabled !== undefined) updateData.jewelleryTcsEnabled = jewelleryTcsEnabled;
    if (jewelleryTcsRate !== undefined) updateData.jewelleryTcsRate = Number(jewelleryTcsRate);
    if (jewelleryTcsThreshold !== undefined) updateData.jewelleryTcsThreshold = Number(jewelleryTcsThreshold);
    if (jewelleryDefaultWastagePercent !== undefined) updateData.jewelleryDefaultWastagePercent = Number(jewelleryDefaultWastagePercent);
    if (jewelleryKarigarWastageTolerance !== undefined) updateData.jewelleryKarigarWastageTolerance = Number(jewelleryKarigarWastageTolerance);
    if (jewelleryWeightTolerance !== undefined) updateData.jewelleryWeightTolerance = Number(jewelleryWeightTolerance);
    if (jewelleryBuyRateSpread !== undefined) updateData.jewelleryBuyRateSpread = Number(jewelleryBuyRateSpread);
    if (jewelleryAutoDerivePurities !== undefined) updateData.jewelleryAutoDerivePurities = jewelleryAutoDerivePurities;
    if (jewelleryAgingAlertDays !== undefined) updateData.jewelleryAgingAlertDays = Number(jewelleryAgingAlertDays);
    if (jewelleryReconciliationTolerance !== undefined) updateData.jewelleryReconciliationTolerance = Number(jewelleryReconciliationTolerance);
    if (jewelleryDefaultMakingChargeType !== undefined) updateData.jewelleryDefaultMakingChargeType = jewelleryDefaultMakingChargeType;
    if (jewellerySchemeMaxDuration !== undefined) updateData.jewellerySchemeMaxDuration = Number(jewellerySchemeMaxDuration);
    if (jewellerySchemeBonusMonths !== undefined) updateData.jewellerySchemeBonusMonths = Number(jewellerySchemeBonusMonths);
    if (jewellerySchemeEnforce365Days !== undefined) updateData.jewellerySchemeEnforce365Days = jewellerySchemeEnforce365Days;
    if (jewellerySchemeRedemptionDiscount !== undefined) updateData.jewellerySchemeRedemptionDiscount = Number(jewellerySchemeRedemptionDiscount);
    if (jewelleryThemeEnabled !== undefined) updateData.jewelleryThemeEnabled = jewelleryThemeEnabled;
    if (jewelleryThemeColor !== undefined) updateData.jewelleryThemeColor = jewelleryThemeColor || null;
    if (jewelleryThemePreset !== undefined) updateData.jewelleryThemePreset = jewelleryThemePreset || null;
    if (jewelleryEnabledPurities !== undefined) updateData.jewelleryEnabledPurities = jewelleryEnabledPurities;
    if (jewelleryEnabledMetals !== undefined) updateData.jewelleryEnabledMetals = jewelleryEnabledMetals;

    // Restaurant module settings
    if (isRestaurantModuleEnabled !== undefined) updateData.isRestaurantModuleEnabled = isRestaurantModuleEnabled;
    if (restaurantTablesEnabled !== undefined) updateData.restaurantTablesEnabled = restaurantTablesEnabled;
    if (restaurantKotPrintingEnabled !== undefined) updateData.restaurantKotPrintingEnabled = restaurantKotPrintingEnabled;
    if (restaurantThemeEnabled !== undefined) updateData.restaurantThemeEnabled = restaurantThemeEnabled;
    if (restaurantThemeColor !== undefined) updateData.restaurantThemeColor = restaurantThemeColor || null;
    if (restaurantThemePreset !== undefined) updateData.restaurantThemePreset = restaurantThemePreset || null;

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

        // Seed Jewellery GL accounts if enabling jewellery module
        if (isJewelleryModuleEnabled === true) {
          await seedJewelleryAccounts(tx as never, id);
        }

        // Keep POS clearing accounts aligned with the Cash subtree whenever clearing mode is active.
        if (org.posAccountingMode === "CLEARING_ACCOUNT") {
          await seedPOSClearingAccounts(tx as never, id);
        }

        // Upsert invoice PDF format setting
        if (invoicePdfFormat !== undefined) {
          const existingInvoiceFmt = await tx.setting.findFirst({
            where: { organizationId: id, key: "invoice_pdf_format", userId: null },
          });
          if (existingInvoiceFmt) {
            await tx.setting.update({ where: { id: existingInvoiceFmt.id }, data: { value: invoicePdfFormat } });
          } else {
            await tx.setting.create({ data: { organizationId: id, key: "invoice_pdf_format", value: invoicePdfFormat } });
          }
        }

        // Upsert transfer PDF format setting
        if (transferPdfFormat !== undefined) {
          const existingTransferFmt = await tx.setting.findFirst({
            where: { organizationId: id, key: "transfer_pdf_format", userId: null },
          });
          if (existingTransferFmt) {
            await tx.setting.update({ where: { id: existingTransferFmt.id }, data: { value: transferPdfFormat } });
          } else {
            await tx.setting.create({ data: { organizationId: id, key: "transfer_pdf_format", value: transferPdfFormat } });
          }
        }

        // Upsert transfer PDF hide cost setting
        if (transferPdfHideCost !== undefined) {
          const existingHideCost = await tx.setting.findFirst({
            where: { organizationId: id, key: "transfer_pdf_hide_cost", userId: null },
          });
          if (existingHideCost) {
            await tx.setting.update({ where: { id: existingHideCost.id }, data: { value: String(transferPdfHideCost) } });
          } else {
            await tx.setting.create({ data: { organizationId: id, key: "transfer_pdf_hide_cost", value: String(transferPdfHideCost) } });
          }
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

    const org = await prisma.organization.findUnique({
      where: { id },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Cascade-delete all associated data in dependency order

    // Jewellery module data
    await prisma.schemePayment.deleteMany({ where: { organizationId: id } });
    await prisma.customerScheme.deleteMany({ where: { organizationId: id } });
    await prisma.karigarTransaction.deleteMany({ where: { organizationId: id } });
    await prisma.oldGoldPurchase.deleteMany({ where: { organizationId: id } });
    await prisma.jewelleryRepair.deleteMany({ where: { organizationId: id } });
    await prisma.stoneDetail.deleteMany({ where: { organizationId: id } });
    await prisma.jewelleryItem.deleteMany({ where: { organizationId: id } });
    await prisma.karigar.deleteMany({ where: { organizationId: id } });
    await prisma.jewelleryCategory.deleteMany({ where: { organizationId: id } });
    await prisma.goldRate.deleteMany({ where: { organizationId: id } });

    // 0. Dependent auxiliary models
    await prisma.mobileDevice.deleteMany({ where: { organizationId: id } });
    await prisma.pOSRegisterConfig.deleteMany({ where: { organizationId: id } });

    // 1. Delete dependent transactional records (allocations and consumptions)
    await prisma.paymentAllocation.deleteMany({ where: { organizationId: id } });
    await prisma.supplierPaymentAllocation.deleteMany({ where: { organizationId: id } });
    await prisma.stockLotConsumption.deleteMany({ where: { organizationId: id } });
    await prisma.debitNoteLotConsumption.deleteMany({ where: { organizationId: id } });
    await prisma.costAuditLog.deleteMany({ where: { organizationId: id } });

    // 2. Stock lots and opening stocks
    await prisma.stockLot.deleteMany({ where: { organizationId: id } });
    await prisma.openingStock.deleteMany({ where: { organizationId: id } });

    // 3. Delete document line items
    await prisma.invoiceItem.deleteMany({ where: { organizationId: id } });
    await prisma.purchaseInvoiceItem.deleteMany({ where: { organizationId: id } });
    await prisma.quotationItem.deleteMany({ where: { organizationId: id } });
    await prisma.creditNoteItem.deleteMany({ where: { organizationId: id } });
    await prisma.debitNoteItem.deleteMany({ where: { organizationId: id } });
    await prisma.stockTransferItem.deleteMany({ where: { organizationId: id } });
    await prisma.expenseItem.deleteMany({ where: { organizationId: id } });
    await prisma.journalEntryLine.deleteMany({ where: { organizationId: id } });
    await prisma.pOSHeldOrder.deleteMany({ where: { organizationId: id } });

    // 4. Payments
    await prisma.payment.deleteMany({ where: { organizationId: id } });
    await prisma.supplierPayment.deleteMany({ where: { organizationId: id } });

    // Break Quotation-Invoice foreign key loop
    await prisma.quotation.updateMany({
      where: { organizationId: id },
      data: { convertedInvoiceId: null },
    });

    // 5. Core transactional documents
    await prisma.creditNote.deleteMany({ where: { organizationId: id } });
    await prisma.debitNote.deleteMany({ where: { organizationId: id } });
    await prisma.invoice.deleteMany({ where: { organizationId: id } });
    await prisma.purchaseInvoice.deleteMany({ where: { organizationId: id } });
    await prisma.quotation.deleteMany({ where: { organizationId: id } });
    await prisma.stockTransfer.deleteMany({ where: { organizationId: id } });
    await prisma.expense.deleteMany({ where: { organizationId: id } });
    await prisma.journalEntry.deleteMany({ where: { organizationId: id } });
    await prisma.pOSSession.deleteMany({ where: { organizationId: id } });

    // 6. Statement transactions
    await prisma.cashBankTransaction.deleteMany({ where: { organizationId: id } });
    await prisma.customerTransaction.deleteMany({ where: { organizationId: id } });
    await prisma.supplierTransaction.deleteMany({ where: { organizationId: id } });

    // 7. Master data
    await prisma.customerAssignment.deleteMany({ where: { organizationId: id } });
    await prisma.customer.deleteMany({ where: { organizationId: id } });
    await prisma.supplier.deleteMany({ where: { organizationId: id } });
    await prisma.unitConversion.deleteMany({ where: { organizationId: id } });
    await prisma.productBundleItem.deleteMany({ where: { organizationId: id } });
    await prisma.product.deleteMany({ where: { organizationId: id } });
    await prisma.productCategory.deleteMany({ where: { organizationId: id } });
    await prisma.unit.deleteMany({ where: { organizationId: id } });

    // 8. Infrastructure
    await prisma.userWarehouseAccess.deleteMany({ where: { organizationId: id } });
    await prisma.warehouse.deleteMany({ where: { organizationId: id } });
    await prisma.branch.deleteMany({ where: { organizationId: id } });
    await prisma.cashBankAccount.deleteMany({ where: { organizationId: id } });
    await prisma.account.deleteMany({ where: { organizationId: id } });

    // 9. Users, settings, and the organization itself
    await prisma.setting.deleteMany({ where: { organizationId: id } });
    await prisma.user.deleteMany({ where: { organizationId: id } });
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
