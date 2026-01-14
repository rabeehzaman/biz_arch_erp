import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const unit = await prisma.unit.findUnique({
      where: { id },
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
    const { id } = await params;
    const body = await request.json();
    const { code, name, isActive } = body;

    // Check if unit exists
    const existing = await prisma.unit.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // If code is being changed, check for conflicts
    if (code && code.toLowerCase() !== existing.code) {
      const codeExists = await prisma.unit.findUnique({
        where: { code: code.toLowerCase() },
      });

      if (codeExists) {
        return NextResponse.json(
          { error: "Unit code already exists" },
          { status: 409 }
        );
      }
    }

    const unit = await prisma.unit.update({
      where: { id },
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
    const { id } = await params;

    // Check if unit has associated products
    const unit = await prisma.unit.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    if (unit._count.products > 0) {
      // Soft delete - just deactivate
      const updated = await prisma.unit.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({
        message: "Unit deactivated (has associated products)",
        unit: updated,
      });
    }

    // Hard delete if no products
    await prisma.unit.delete({
      where: { id },
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
