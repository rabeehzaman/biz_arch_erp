import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { renderToBuffer } from "@react-pdf/renderer";
import { LedgerPDF } from "@/components/pdf/ledger-pdf";
import { getLedgerData } from "@/lib/reports/ledger";
import { createElement } from "react";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as "ACCOUNT" | "CUSTOMER" | "SUPPLIER";
    const id = searchParams.get("id");
    const fromDate = searchParams.get("fromDate") || undefined;
    const toDate = searchParams.get("toDate") || undefined;
    const lang = (searchParams.get("lang") === "ar" ? "ar" : "en") as "en" | "ar";

    if (!type || !id) {
      return NextResponse.json({ error: "Missing type or id" }, { status: 400 });
    }

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
      getLedgerData(organizationId, type, id, fromDate, toDate),
    ]);

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const pdfBuffer = await renderToBuffer(
      createElement(LedgerPDF, {
        organization,
        data,
        fromDate,
        toDate,
        lang,
      }) as any
    );

    const safeName = data.entityName.replace(/[^a-zA-Z0-9-_]/g, "-");
    const dateSuffix = fromDate && toDate ? `-${fromDate}-to-${toDate}` : "";

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ledger-${safeName}${dateSuffix}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate ledger PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate ledger PDF" },
      { status: 500 }
    );
  }
}
