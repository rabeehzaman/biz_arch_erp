import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);

    const employees = await prisma.employee.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(employees);
  } catch (error) {
    console.error("Failed to fetch employees:", error);
    return NextResponse.json(
      { error: "Failed to fetch employees" },
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
    const { name, pinCode, isActive } = body;

    if (!name || !pinCode) {
      return NextResponse.json(
        { error: "Name and PIN code are required" },
        { status: 400 }
      );
    }

    // Check if employee with same pinCode exists in this org
    const existing = await prisma.employee.findFirst({
      where: { organizationId, pinCode },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An employee with this PIN code already exists" },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.create({
      data: {
        name,
        pinCode,
        isActive: isActive !== undefined ? isActive : true,
        organizationId,
      },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    console.error("Failed to create employee:", error);
    return NextResponse.json(
      { error: "Failed to create employee" },
      { status: 500 }
    );
  }
}
