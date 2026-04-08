import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { tableId } = await params;

    // Find any open order for this table across ALL open sessions in the org
    const order = await prisma.pOSOpenOrder.findFirst({
      where: {
        organizationId,
        tableId,
        session: { status: "OPEN" },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ order: order || null });
  } catch (error) {
    console.error("Failed to lookup order by table:", error);
    return NextResponse.json(
      { error: "Failed to lookup order by table" },
      { status: 500 }
    );
  }
}
