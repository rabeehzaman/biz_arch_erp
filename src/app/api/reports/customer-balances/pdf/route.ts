import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { renderToBuffer } from "@react-pdf/renderer";
import { CustomerBalancesPDF } from "@/components/pdf/customer-balances-pdf";
import { getCustomerBalancesData } from "@/lib/reports/customer-balances";
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
      getCustomerBalancesData(organizationId, branchId),
    ]);

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const pdfBuffer = await renderToBuffer(
      createElement(CustomerBalancesPDF, {
        organization,
        data,
        lang,
      }) as any
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="customer-balances.pdf"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate customer balances PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate customer balances PDF" },
      { status: 500 }
    );
  }
}
