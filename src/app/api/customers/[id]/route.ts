import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

// Helper to check if user can access a customer
async function canAccessCustomer(customerId: string, organizationId: string, userId: string, isAdmin: boolean) {
  if (isAdmin) return true;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId, organizationId },
    include: { assignments: true },
  });

  if (!customer) return false;

  // Allow access only if customer is assigned to user
  return customer.assignments.some(a => a.userId === userId);
}

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
    const isAdmin = session.user.role === "admin";

    if (!await canAccessCustomer(id, organizationId, session.user.id, isAdmin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id, organizationId },
      include: {
        invoices: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        assignments: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(customer);
  } catch (error) {
    console.error("Failed to fetch customer:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer" },
      { status: 500 }
    );
  }
}

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
    const isAdmin = session.user.role === "admin";

    if (!await canAccessCustomer(id, organizationId, session.user.id, isAdmin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, phone, address, city, state, zipCode, country, notes, isActive } = body;

    const customer = await prisma.customer.update({
      where: { id, organizationId },
      data: {
        name,
        email,
        phone,
        address,
        city,
        state,
        zipCode,
        country,
        notes,
        isActive,
      },
      include: {
        assignments: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error("Failed to update customer:", error);
    return NextResponse.json(
      { error: "Failed to update customer" },
      { status: 500 }
    );
  }
}

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
    const isAdmin = session.user.role === "admin";

    if (!await canAccessCustomer(id, organizationId, session.user.id, isAdmin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.customer.delete({
      where: { id, organizationId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete customer:", error);
    return NextResponse.json(
      { error: "Failed to delete customer" },
      { status: 500 }
    );
  }
}
