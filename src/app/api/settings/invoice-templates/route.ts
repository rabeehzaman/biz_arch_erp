import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { getEditionConfig } from "@/lib/edition";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);

    const [org, assignedSetting, defaultSetting] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { edition: true },
      }),
      prisma.setting.findFirst({
        where: { organizationId, key: "assigned_invoice_templates", userId: null },
        select: { value: true },
      }),
      prisma.setting.findFirst({
        where: { organizationId, key: "invoice_pdf_format", userId: null },
        select: { value: true },
      }),
    ]);

    // Fall back to edition defaults if no assignment exists
    let assigned: string[] = [];
    if (assignedSetting) {
      try { assigned = JSON.parse(assignedSetting.value); } catch { /* ignore */ }
    }
    if (assigned.length === 0) {
      const editionConfig = getEditionConfig(org?.edition);
      assigned = [...editionConfig.allowedInvoicePdfFormats];
    }

    return NextResponse.json({
      assigned,
      default: defaultSetting?.value || assigned[0] || "A5_LANDSCAPE",
    });
  } catch (error) {
    console.error("Failed to fetch invoice templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice templates" },
      { status: 500 }
    );
  }
}
