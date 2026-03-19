import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isJewelleryModuleEnabled } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isJewelleryModuleEnabled(session)) {
      return NextResponse.json({ error: "Jewellery module is not enabled" }, { status: 403 });
    }

    const organizationId = getOrgId(session);

    const categories = await prisma.jewelleryCategory.findMany({
      where: { organizationId },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Failed to fetch jewellery categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch jewellery categories" },
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

    if (!isJewelleryModuleEnabled(session)) {
      return NextResponse.json({ error: "Jewellery module is not enabled" }, { status: 403 });
    }

    const organizationId = getOrgId(session);
    const body = await request.json();
    const { name, arabicName, metalType, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    // Auto-generate slug from name
    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    // Check for duplicate slug within org
    const existing = await prisma.jewelleryCategory.findUnique({
      where: {
        organizationId_slug: { organizationId, slug },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A category with this name already exists" },
        { status: 409 }
      );
    }

    // Get max sortOrder for auto-increment
    const maxSort = await prisma.jewelleryCategory.aggregate({
      where: { organizationId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxSort._max.sortOrder ?? 0) + 1;

    const category = await prisma.jewelleryCategory.create({
      data: {
        organizationId,
        name,
        arabicName: arabicName || null,
        slug,
        metalType: metalType || "GOLD",
        description: description || null,
        sortOrder,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Failed to create jewellery category:", error);
    return NextResponse.json(
      { error: "Failed to create jewellery category" },
      { status: 500 }
    );
  }
}
