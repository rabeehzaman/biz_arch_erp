import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const userId = session.user.id;
    const isAdmin = session.user.role === "admin";

    let customers;

    if (isAdmin) {
      // Admin sees all customers in their org
      customers = await prisma.customer.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { invoices: true },
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
    } else {
      // Regular user sees only customers assigned to them
      customers = await prisma.customer.findMany({
        where: {
          organizationId,
          assignments: { some: { userId } },
        },
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { invoices: true },
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
    }

    return NextResponse.json(customers);
  } catch (error) {
    console.error("Failed to fetch customers:", error);
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const body = await request.json();
    const { name, email, phone, address, city, state, zipCode, country, notes } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Create customer and auto-assign to creator
    const customer = await prisma.customer.create({
      data: {
        organizationId,
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
        country: country || "India",
        notes: notes || null,
        assignments: {
          create: {
            userId: session.user.id,
            organizationId,
          },
        },
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

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error("Failed to create customer:", error);
    return NextResponse.json(
      { error: "Failed to create customer" },
      { status: 500 }
    );
  }
}
