import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { renderToBuffer } from "@react-pdf/renderer";
import { SupplierBalancesPDF } from "@/components/pdf/supplier-balances-pdf";
import { getSupplierBalancesData } from "@/lib/reports/supplier-balances";
import { createElement } from "react";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { searchParams } = new URL(request.url);
    const lang = (searchParams.get("lang") === "ar" ? "ar" : "en") as "en" | "ar";
    const branchId = searchParams.get("branchId") || undefined;

    const [organization, data] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          name: true,
          arabicName: true,
          brandColor: true,
          currency: true,
        },
      }),
      getSupplierBalancesData(organizationId, branchId),
    ]);

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const pdfBuffer = await renderToBuffer(
      createElement(SupplierBalancesPDF, {
        organization,
        data,
        lang,
      }) as any
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="supplier-balances.pdf"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate supplier balances PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate supplier balances PDF" },
      { status: 500 }
    );
  }
}
