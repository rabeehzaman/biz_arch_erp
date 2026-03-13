import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";
import { getPOSSessionReportData } from "@/lib/pos/session-summary";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;

    const [reportData, organization] = await Promise.all([
      getPOSSessionReportData(organizationId, id),
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          name: true,
          arabicName: true,
          currency: true,
          brandColor: true,
        },
      }),
    ]);
    if (!reportData) {
      return NextResponse.json({ error: "POS session not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...reportData,
      organization: {
        name: organization?.name || null,
        arabicName: organization?.arabicName || null,
        currency: organization?.currency || "INR",
        brandColor: organization?.brandColor || null,
      },
      topProducts: reportData.soldProducts.slice(0, 10),
    });
  } catch (error) {
    console.error("Failed to fetch POS session summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch POS session summary" },
      { status: 500 }
    );
  }
}
