import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { canAccessCustomer, isAdminRole } from "@/lib/access-control";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { id, commentId } = await params;
    const isAdmin = isAdminRole(session.user.role);

    // Check salesman assignment
    if (!await canAccessCustomer(id, organizationId, session.user.id, isAdmin)) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Find the comment and verify ownership
    const comment = await prisma.customerComment.findFirst({
      where: {
        id: commentId,
        customerId: id,
        organizationId,
      },
    });

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Only the author or an admin can delete
    if (comment.userId !== session.user.id && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.customerComment.delete({
      where: { id: commentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete customer comment:", error);
    return NextResponse.json(
      { error: "Failed to delete customer comment" },
      { status: 500 }
    );
  }
}
