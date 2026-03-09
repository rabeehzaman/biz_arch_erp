import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { format } from "date-fns";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { getPOSSessionReportData } from "@/lib/pos/session-summary";
import { POSSessionReportPDF } from "@/components/pdf/pos-session-report-pdf";

const sanitizeFilenamePart = (value: string): string =>
  value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const dispositionType = searchParams.get("download") === "0" ? "inline" : "attachment";

    const [organization, report] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          name: true,
          arabicName: true,
          brandColor: true,
          currency: true,
        },
      }),
      getPOSSessionReportData(organizationId, id),
    ]);

    if (!report) {
      return NextResponse.json({ error: "POS session not found" }, { status: 404 });
    }

    const pdfBuffer = await renderToBuffer(
      createElement(POSSessionReportPDF, {
        organization: {
          name: organization?.name || "Organization",
          arabicName: organization?.arabicName ?? null,
          brandColor: organization?.brandColor ?? null,
          currency: organization?.currency || "INR",
        },
        report,
        generatedAt: new Date(),
      }) as any
    );

    const filename = `pos-session-${sanitizeFilenamePart(report.session.sessionNumber)}-${format(
      new Date(report.session.openedAt),
      "yyyy-MM-dd"
    )}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${dispositionType}; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate POS session PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
