import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// POST /api/organizations/switch — switch the current user's active organization
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId } = await request.json();
    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 }
      );
    }

    // Verify the user has an active membership in this org
    const membership = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId,
        },
      },
      include: {
        organization: {
          select: {
            edition: true,
            gstEnabled: true,
            eInvoicingEnabled: true,
            multiUnitEnabled: true,
            multiBranchEnabled: true,
            isMobileShopModuleEnabled: true,
            isWeighMachineEnabled: true,
            isJewelleryModuleEnabled: true,
            isRestaurantModuleEnabled: true,
            isPriceListEnabled: true,
            weighMachineBarcodePrefix: true,
            weighMachineProductCodeLen: true,
            weighMachineWeightDigits: true,
            weighMachineDecimalPlaces: true,
            gstStateCode: true,
            saudiEInvoiceEnabled: true,
            isTaxInclusivePrice: true,
            language: true,
            currency: true,
          },
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "You are not a member of this organization" },
        { status: 403 }
      );
    }

    // Get user's language preference (per-user override takes priority)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { language: true },
    });

    // Persist the active org on the user record
    await prisma.user.update({
      where: { id: session.user.id },
      data: { organizationId, role: membership.role },
    });

    // Look up price list for this user in the target org
    let priceListId: string | null = null;
    if (membership.organization.isPriceListEnabled) {
      const assignment = await prisma.priceListAssignment.findUnique({
        where: { userId: session.user.id },
        select: { priceListId: true },
      });
      priceListId = assignment?.priceListId ?? null;
    }

    const org = membership.organization;

    // Return the full org context for JWT refresh
    return NextResponse.json({
      switchOrgContext: {
        organizationId,
        role: membership.role,
        edition: org.edition ?? "INDIA",
        gstEnabled: org.gstEnabled ?? false,
        eInvoicingEnabled: org.eInvoicingEnabled ?? false,
        multiUnitEnabled: org.multiUnitEnabled ?? false,
        multiBranchEnabled: org.multiBranchEnabled ?? false,
        isMobileShopModuleEnabled: org.isMobileShopModuleEnabled ?? false,
        isWeighMachineEnabled: org.isWeighMachineEnabled ?? false,
        isJewelleryModuleEnabled: org.isJewelleryModuleEnabled ?? false,
        isRestaurantModuleEnabled: org.isRestaurantModuleEnabled ?? false,
        isPriceListEnabled: org.isPriceListEnabled ?? false,
        priceListId,
        weighMachineBarcodePrefix: org.weighMachineBarcodePrefix ?? "77",
        weighMachineProductCodeLen: org.weighMachineProductCodeLen ?? 5,
        weighMachineWeightDigits: org.weighMachineWeightDigits ?? 5,
        weighMachineDecimalPlaces: org.weighMachineDecimalPlaces ?? 3,
        gstStateCode: org.gstStateCode ?? null,
        saudiEInvoiceEnabled: org.saudiEInvoiceEnabled ?? false,
        isTaxInclusivePrice: org.isTaxInclusivePrice ?? false,
        language: user?.language ?? org.language ?? "en",
        currency: org.currency ?? "INR",
      },
    });
  } catch (error) {
    console.error("Failed to switch organization:", error);
    return NextResponse.json(
      { error: "Failed to switch organization" },
      { status: 500 }
    );
  }
}
