import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function PUT(
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
    const { tableId } = await request.json();

    if (!tableId) {
      return NextResponse.json({ error: "tableId is required" }, { status: 400 });
    }

    const existing = await prisma.kOTOrder.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "KOT not found" }, { status: 404 });
    }

    const kot = await prisma.kOTOrder.update({
      where: { id },
      data: { tableId },
    });

    return NextResponse.json(kot);
  } catch (error) {
    console.error("Failed to move KOT to new table:", error);
    return NextResponse.json(
      { error: "Failed to move KOT" },
      { status: 500 }
    );
  }
}
