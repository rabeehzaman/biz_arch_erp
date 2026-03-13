import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

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

    const employee = await prisma.employee.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        _count: {
          select: { posSessions: true },
        },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    return NextResponse.json(employee);
  } catch (error) {
    console.error("Failed to fetch employee:", error);
    return NextResponse.json(
      { error: "Failed to fetch employee" },
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
    const body = await request.json();

    const employee = await prisma.employee.findFirst({
      where: { id, organizationId },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    if (body.pinCode && body.pinCode !== employee.pinCode) {
      const existing = await prisma.employee.findFirst({
        where: { organizationId, pinCode: body.pinCode },
      });

      if (existing) {
        return NextResponse.json(
          { error: "An employee with this PIN code already exists" },
          { status: 400 }
        );
      }
    }

    const updatedEmployee = await prisma.employee.update({
      where: { id },
      data: {
        name: body.name,
        pinCode: body.pinCode,
        isActive: body.isActive,
      },
    });

    return NextResponse.json(updatedEmployee);
  } catch (error) {
    console.error("Failed to update employee:", error);
    return NextResponse.json(
      { error: "Failed to update employee" },
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

    const employee = await prisma.employee.findFirst({
      where: { id, organizationId },
      include: {
        _count: {
          select: { posSessions: true },
        },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    if (employee._count.posSessions > 0) {
      return NextResponse.json(
        { error: "Cannot delete employee with associated POS sessions. Deactivate them instead." },
        { status: 400 }
      );
    }

    await prisma.employee.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete employee:", error);
    return NextResponse.json(
      { error: "Failed to delete employee" },
      { status: 500 }
    );
  }
}
