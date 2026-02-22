import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function DELETE(
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

    // Verify the held order belongs to this organization
    const heldOrder = await prisma.pOSHeldOrder.findFirst({
      where: { id, organizationId },
    });

    if (!heldOrder) {
      return NextResponse.json(
        { error: "Held order not found" },
        { status: 404 }
      );
    }

    await prisma.pOSHeldOrder.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete held order:", error);
    return NextResponse.json(
      { error: "Failed to delete held order" },
      { status: 500 }
    );
  }
}
