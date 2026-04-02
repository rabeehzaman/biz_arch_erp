import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { canAccessCustomer, isAdminRole } from "@/lib/access-control";

export async function GET(
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

    // Check salesman assignment
    if (!await canAccessCustomer(id, organizationId, session.user.id, isAdminRole(session.user.role))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const comments = await prisma.customerComment.findMany({
      where: { customerId: id, organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error("Failed to fetch customer comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer comments" },
      { status: 500 }
    );
  }
}

export async function POST(
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

    // Check salesman assignment
    if (!await canAccessCustomer(id, organizationId, session.user.id, isAdminRole(session.user.role))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const comment = await prisma.customerComment.create({
      data: {
        customerId: id,
        userId: session.user.id,
        organizationId,
        content: content.trim(),
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Failed to create customer comment:", error);
    return NextResponse.json(
      { error: "Failed to create customer comment" },
      { status: 500 }
    );
  }
}
