import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { renderToBuffer } from "@react-pdf/renderer";
import { APAgingPDF } from "@/components/pdf/ap-aging-pdf";
import { getAPAgingData } from "@/lib/reports/ap-aging";
import { createElement } from "react";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { searchParams } = new URL(request.url);
    const asOfDate =
      searchParams.get("asOfDate") || new Date().toISOString().split("T")[0];
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
      getAPAgingData(organizationId, asOfDate),
    ]);

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const pdfBuffer = await renderToBuffer(
      createElement(APAgingPDF, {
        organization,
        data,
        asOfDate,
        lang,
      }) as any
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ap-aging-${asOfDate}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate AP aging PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate AP aging PDF" },
      { status: 500 }
    );
  }
}
