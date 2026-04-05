import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// DELETE /api/admin/organizations/[id]/members/[userId] — remove a user from this org
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: organizationId, userId } = await params;

    // Delete the membership
    const deleted = await prisma.userOrganization.deleteMany({
      where: { userId, organizationId },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: "Membership not found" },
        { status: 404 }
      );
    }

    // If this was the user's active org, switch to next available membership
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    if (user?.organizationId === organizationId) {
      const nextMembership = await prisma.userOrganization.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
      });

      await prisma.user.update({
        where: { id: userId },
        data: {
          organizationId: nextMembership?.organizationId ?? null,
          role: nextMembership?.role ?? "user",
        },
      });
    }

    return NextResponse.json({ message: "Member removed from organization" });
  } catch (error) {
    console.error("Failed to remove member:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}
