import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

// GET - Get current assignments for a customer
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

    const assignments = await prisma.customerAssignment.findMany({
      where: { customerId: id, organizationId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { assignedAt: "desc" },
    });

    return NextResponse.json(assignments);
  } catch (error) {
    console.error("Failed to fetch assignments:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}

// POST - Add user(s) to customer assignments
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

    // Only admins can assign customers
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { userIds } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: "userIds array is required" },
        { status: 400 }
      );
    }

    // Check if customer exists
    const customer = await prisma.customer.findUnique({ where: { id, organizationId } });
    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Create assignments (skip duplicates using skipDuplicates)
    await prisma.customerAssignment.createMany({
      data: userIds.map((userId: string) => ({
        customerId: id,
        userId,
        organizationId,
      })),
      skipDuplicates: true,
    });

    // Return updated assignments
    const assignments = await prisma.customerAssignment.findMany({
      where: { customerId: id, organizationId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json(assignments, { status: 201 });
  } catch (error) {
    console.error("Failed to create assignments:", error);
    return NextResponse.json(
      { error: "Failed to create assignments" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a user from customer assignments
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

    // Only admins can unassign customers
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    await prisma.customerAssignment.deleteMany({
      where: {
        customerId: id,
        userId,
        organizationId,
      },
    });

    // Return updated assignments
    const assignments = await prisma.customerAssignment.findMany({
      where: { customerId: id, organizationId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json(assignments);
  } catch (error) {
    console.error("Failed to remove assignment:", error);
    return NextResponse.json(
      { error: "Failed to remove assignment" },
      { status: 500 }
    );
  }
}
