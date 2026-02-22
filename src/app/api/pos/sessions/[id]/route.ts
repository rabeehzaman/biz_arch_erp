import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

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

    const posSession = await prisma.pOSSession.findFirst({
      where: { id, organizationId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        invoices: {
          orderBy: { createdAt: "desc" },
          include: {
            customer: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        _count: {
          select: { invoices: true, heldOrders: true },
        },
      },
    });

    if (!posSession) {
      return NextResponse.json({ error: "POS session not found" }, { status: 404 });
    }

    return NextResponse.json(posSession);
  } catch (error) {
    console.error("Failed to fetch POS session:", error);
    return NextResponse.json(
      { error: "Failed to fetch POS session" },
      { status: 500 }
    );
  }
}
