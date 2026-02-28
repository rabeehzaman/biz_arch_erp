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
    const unit = await prisma.unit.findUnique({
      where: { id, organizationId },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    return NextResponse.json(unit);
  } catch (error) {
    console.error("Failed to fetch unit:", error);
    return NextResponse.json(
      { error: "Failed to fetch unit" },
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
    const { code, name, isActive } = body;

    // Check if unit exists in this org
    const existing = await prisma.unit.findUnique({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // If code is being changed, check for conflicts within org
    if (code && code.toLowerCase() !== existing.code) {
      const codeExists = await prisma.unit.findFirst({
        where: { code: code.toLowerCase(), organizationId },
      });

      if (codeExists) {
        return NextResponse.json(
          { error: "Unit code already exists" },
          { status: 409 }
        );
      }
    }

    const unit = await prisma.unit.update({
      where: { id, organizationId },
      data: {
        ...(code && { code: code.toLowerCase() }),
        ...(name && { name }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(unit);
  } catch (error) {
    console.error("Failed to update unit:", error);
    return NextResponse.json(
      { error: "Failed to update unit" },
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

    // Check if unit has associated products or conversions
    const unit = await prisma.unit.findUnique({
      where: { id, organizationId },
      include: {
        _count: {
          select: {
            products: true,
            conversionsFrom: true,
            conversionsTo: true,
          },
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const hasProducts = unit._count.products > 0;
    const hasConversions = unit._count.conversionsFrom > 0 || unit._count.conversionsTo > 0;

    if (hasProducts || hasConversions) {
      // Soft delete - just deactivate
      const updated = await prisma.unit.update({
        where: { id, organizationId },
        data: { isActive: false },
      });
      const reason = hasProducts && hasConversions
        ? "has associated products and conversion rules"
        : hasProducts
          ? "has associated products"
          : "has associated conversion rules";
      return NextResponse.json({
        message: `Unit deactivated (${reason})`,
        unit: updated,
      });
    }

    // Hard delete if no products and no conversions
    await prisma.unit.delete({
      where: { id, organizationId },
    });

    return NextResponse.json({ message: "Unit deleted successfully" });
  } catch (error) {
    console.error("Failed to delete unit:", error);
    return NextResponse.json(
      { error: "Failed to delete unit" },
      { status: 500 }
    );
  }
}
