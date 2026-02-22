import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

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
    const { name, slug, color, sortOrder, isActive } = body;

    // Check if category exists in this org
    const existing = await prisma.productCategory.findUnique({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // If slug is being changed, check for conflicts within org
    if (slug && slug !== existing.slug) {
      const slugExists = await prisma.productCategory.findUnique({
        where: {
          organizationId_slug: { organizationId, slug },
        },
      });

      if (slugExists) {
        return NextResponse.json(
          { error: "A category with this slug already exists" },
          { status: 409 }
        );
      }
    }

    const category = await prisma.productCategory.update({
      where: { id, organizationId },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
        ...(color && { color }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error("Failed to update product category:", error);
    return NextResponse.json(
      { error: "Failed to update product category" },
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

    // Check if category exists and has associated products
    const category = await prisma.productCategory.findUnique({
      where: { id, organizationId },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    if (category._count.products > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete category. ${category._count.products} product(s) are assigned to it.`,
        },
        { status: 400 }
      );
    }

    await prisma.productCategory.delete({
      where: { id, organizationId },
    });

    return NextResponse.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Failed to delete product category:", error);
    return NextResponse.json(
      { error: "Failed to delete product category" },
      { status: 500 }
    );
  }
}
