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

    const [employees, org] = await Promise.all([
      prisma.employee.findMany({
        where: { organizationId },
        orderBy: { name: "asc" },
      }),
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { posEmployeePinRequired: true },
      }),
    ]);

    return NextResponse.json({
      employees,
      posEmployeePinRequired: org?.posEmployeePinRequired ?? false,
    });
  } catch (error) {
    console.error("Failed to fetch employees:", error);
    return NextResponse.json(
      { error: "Failed to fetch employees" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "admin" && session.user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const organizationId = getOrgId(session);
    const body = await request.json();
    const { posEmployeePinRequired } = body;

    if (typeof posEmployeePinRequired !== "boolean") {
      return NextResponse.json(
        { error: "posEmployeePinRequired must be a boolean" },
        { status: 400 }
      );
    }

    await prisma.organization.update({
      where: { id: organizationId },
      data: { posEmployeePinRequired },
    });

    return NextResponse.json({ success: true, posEmployeePinRequired });
  } catch (error) {
    console.error("Failed to update employee PIN setting:", error);
    return NextResponse.json(
      { error: "Failed to update setting" },
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

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Check if PIN is required by org settings
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { posEmployeePinRequired: true },
    });

    if (org?.posEmployeePinRequired && !pinCode) {
      return NextResponse.json(
        { error: "PIN code is required when employee PIN is enabled" },
        { status: 400 }
      );
    }

    // Check if employee with same pinCode exists in this org
    if (pinCode) {
      const existing = await prisma.employee.findFirst({
        where: { organizationId, pinCode },
      });

      if (existing) {
        return NextResponse.json(
          { error: "An employee with this PIN code already exists" },
          { status: 400 }
        );
      }
    }

    const employee = await prisma.employee.create({
      data: {
        name,
        pinCode: pinCode || null,
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
