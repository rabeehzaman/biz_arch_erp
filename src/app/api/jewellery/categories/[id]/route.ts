import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isJewelleryModuleEnabled } from "@/lib/auth-utils";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isJewelleryModuleEnabled(session)) {
      return NextResponse.json({ error: "Jewellery module is not enabled" }, { status: 403 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;
    const body = await request.json();
    const { name, arabicName, metalType, description, sortOrder, isActive } = body;

    // Check if category exists in this org
    const existing = await prisma.jewelleryCategory.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // If name is changing, re-derive slug and check for conflicts
    let newSlug: string | null = null;
    if (name && name !== existing.name) {
      newSlug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

      if (newSlug !== existing.slug) {
        const slugExists = await prisma.jewelleryCategory.findUnique({
          where: {
            organizationId_slug: { organizationId, slug: newSlug! },
          },
        });

        if (slugExists) {
          return NextResponse.json(
            { error: "A category with this name already exists" },
            { status: 409 }
          );
        }
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (newSlug !== null) updateData.slug = newSlug;
    if (arabicName !== undefined) updateData.arabicName = arabicName || null;
    if (metalType !== undefined) updateData.metalType = metalType;
    if (description !== undefined) updateData.description = description || null;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (isActive !== undefined) updateData.isActive = isActive;

    const category = await prisma.jewelleryCategory.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error("Failed to update jewellery category:", error);
    return NextResponse.json(
      { error: "Failed to update jewellery category" },
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

    if (!isJewelleryModuleEnabled(session)) {
      return NextResponse.json({ error: "Jewellery module is not enabled" }, { status: 403 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;

    // Check if category exists and has associated items
    const category = await prisma.jewelleryCategory.findFirst({
      where: { id, organizationId },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    if (category._count.items > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete category. ${category._count.items} item(s) are assigned to it.`,
        },
        { status: 400 }
      );
    }

    await prisma.jewelleryCategory.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete jewellery category:", error);
    return NextResponse.json(
      { error: "Failed to delete jewellery category" },
      { status: 500 }
    );
  }
}
