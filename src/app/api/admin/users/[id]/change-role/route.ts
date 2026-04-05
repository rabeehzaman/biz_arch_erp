import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

const ALLOWED_ROLES = ["admin", "user", "pos"];

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { role } = body;

    if (!role || !ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `Role must be one of: ${ALLOWED_ROLES.join(", ")}` },
        { status: 400 }
      );
    }

    const { organizationId } = body;

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, organizationId: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetUser.id === session.user.id) {
      return NextResponse.json(
        { error: "Cannot change your own role from here" },
        { status: 400 }
      );
    }

    if (targetUser.role === "superadmin") {
      return NextResponse.json(
        { error: "Cannot change another superadmin's role" },
        { status: 403 }
      );
    }

    // Determine which org's membership to update
    const orgId = organizationId || targetUser.organizationId;

    await prisma.$transaction(async (tx) => {
      // Update UserOrganization role if org context is known
      if (orgId) {
        await tx.userOrganization.updateMany({
          where: { userId: id, organizationId: orgId },
          data: { role },
        });
      }

      // Also update user.role if this is the user's active org
      if (!orgId || orgId === targetUser.organizationId) {
        await tx.user.update({
          where: { id },
          data: { role },
        });
      }
    });

    return NextResponse.json({ message: "Role updated successfully" });
  } catch (error) {
    console.error("Failed to change role:", error);
    return NextResponse.json(
      { error: "Failed to change role" },
      { status: 500 }
    );
  }
}
