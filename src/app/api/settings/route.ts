import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import {
  DEFAULT_SETTINGS,
  type CompanySettingsFormData,
} from "@/lib/validations/settings";
import { normalizeRoundOffMode } from "@/lib/round-off";

// Backward-compatible shim: reads from Organization table
// instead of Setting key-value table. POS components depend on this shape.
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
        name: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        phone: true,
        email: true,
        gstin: true,
        bankName: true,
        bankAccountNumber: true,
        bankIfscCode: true,
        bankBranch: true,
        roundOffMode: true,
        isPriceListEnabled: true,
        isRestaurantModuleEnabled: true,
        isManufacturingModuleEnabled: true,
      },
    });

    if (!org) {
      return NextResponse.json(DEFAULT_SETTINGS);
    }

    const result: CompanySettingsFormData & { isPriceListEnabled?: boolean; isRestaurantModuleEnabled?: boolean; isManufacturingModuleEnabled?: boolean } = {
      companyName: org.name || "",
      companyAddress: org.address || "",
      companyCity: org.city || "",
      companyState: org.state || "",
      companyZipCode: org.zipCode || "",
      companyCountry: org.country || "",
      companyPhone: org.phone || "",
      companyEmail: org.email || "",
      companyGstNumber: org.gstin || "",
      bankName: org.bankName || "",
      bankAccountNumber: org.bankAccountNumber || "",
      bankIfscCode: org.bankIfscCode || "",
      bankBranch: org.bankBranch || "",
      roundOffMode: normalizeRoundOffMode(org.roundOffMode),
      isPriceListEnabled: org.isPriceListEnabled ?? false,
      isRestaurantModuleEnabled: org.isRestaurantModuleEnabled ?? false,
      isManufacturingModuleEnabled: org.isManufacturingModuleEnabled ?? false,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

// Company settings are now managed by super admin via /api/admin/organizations/[id]
export async function PUT() {
  return NextResponse.json(
    { error: "Company settings are now managed by the super admin in Organization settings" },
    { status: 410 }
  );
}
