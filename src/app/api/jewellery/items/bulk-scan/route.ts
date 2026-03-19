import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isJewelleryModuleEnabled } from "@/lib/auth-utils";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isJewelleryModuleEnabled(session)) return NextResponse.json({ error: "Jewellery module is not enabled" }, { status: 403 });
    const organizationId = getOrgId(session);

    const body = await request.json();
    const { tagNumbers } = body;

    if (!Array.isArray(tagNumbers) || tagNumbers.length === 0) {
      return NextResponse.json(
        { error: "tagNumbers must be a non-empty array of strings" },
        { status: 400 }
      );
    }

    if (tagNumbers.length > 200) {
      return NextResponse.json(
        { error: "Maximum 200 tag numbers per request" },
        { status: 400 }
      );
    }

    const items = await prisma.jewelleryItem.findMany({
      where: {
        organizationId,
        tagNumber: { in: tagNumbers },
      },
      include: {
        category: true,
        stoneDetails: true,
      },
    });

    // Build a lookup of found tag numbers for easy cross-reference
    const foundTags = new Set(items.map((item) => item.tagNumber));
    const notFoundTags = tagNumbers.filter((tag: string) => !foundTags.has(tag));

    return NextResponse.json({
      items,
      found: items.length,
      notFound: notFoundTags,
      notFoundCount: notFoundTags.length,
    });
  } catch (error) {
    console.error("Failed to bulk scan jewellery items:", error);
    return NextResponse.json({ error: "Failed to bulk scan items" }, { status: 500 });
  }
}
