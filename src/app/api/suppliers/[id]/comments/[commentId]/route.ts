import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

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
    const isAdmin = session.user.role === "admin";

    // Verify supplier belongs to this org
    const supplier = await prisma.supplier.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    // Find the comment and verify ownership
    const comment = await prisma.supplierComment.findFirst({
      where: {
        id: commentId,
        supplierId: id,
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

    await prisma.supplierComment.delete({
      where: { id: commentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete supplier comment:", error);
    return NextResponse.json(
      { error: "Failed to delete supplier comment" },
      { status: 500 }
    );
  }
}
