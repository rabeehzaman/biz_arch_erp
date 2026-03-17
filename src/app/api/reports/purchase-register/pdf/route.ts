import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { renderToBuffer } from "@react-pdf/renderer";
import { PurchaseRegisterPDF } from "@/components/pdf/purchase-register-pdf";
import { getPurchaseRegisterData } from "@/lib/reports/purchase-register";
import { createElement } from "react";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { searchParams } = new URL(request.url);
    const fromDate =
      searchParams.get("fromDate") ||
      new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .split("T")[0];
    const toDate =
      searchParams.get("toDate") || new Date().toISOString().split("T")[0];
    const lang = (searchParams.get("lang") === "ar" ? "ar" : "en") as "en" | "ar";

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
      getPurchaseRegisterData(organizationId, fromDate, toDate),
    ]);

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const pdfBuffer = await renderToBuffer(
      createElement(PurchaseRegisterPDF, {
        organization,
        data,
        fromDate,
        toDate,
        lang,
      }) as any
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="purchase-register-${fromDate}-to-${toDate}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate purchase register PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate purchase register PDF" },
      { status: 500 }
    );
  }
}
