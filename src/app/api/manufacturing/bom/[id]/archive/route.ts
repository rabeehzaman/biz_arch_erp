import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isManufacturingModuleEnabled } from "@/lib/auth-utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isManufacturingModuleEnabled(session)) {
      return NextResponse.json({ error: "Manufacturing module not enabled" }, { status: 403 });
    }
    const organizationId = getOrgId(session);
    const { id } = await params;

    const bom = await prisma.billOfMaterials.findFirst({
      where: { id, organizationId },
    });

    if (!bom) {
      return NextResponse.json({ error: "BOM not found" }, { status: 404 });
    }

    if (bom.status === "ARCHIVED") {
      return NextResponse.json({ error: "BOM is already archived" }, { status: 400 });
    }

    await prisma.billOfMaterials.update({
      where: { id },
      data: { status: "ARCHIVED", isDefault: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to archive BOM:", error);
    return NextResponse.json({ error: "Failed to archive BOM" }, { status: 500 });
  }
}
