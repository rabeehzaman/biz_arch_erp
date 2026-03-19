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
    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get("isActive");

    const where: Record<string, unknown> = { organizationId };

    if (isActive !== null) {
      where.isActive = isActive === "true";
    }

    const karigars = await prisma.karigar.findMany({
      where,
      orderBy: { name: "asc" },
    });

    // Compute running balance for each karigar
    const karigarsWithBalance = karigars.map((k) => ({
      ...k,
      runningBalance:
        Number(k.goldIssuedWeight) - Number(k.goldReturnedWeight) - Number(k.scrapReturnedWeight),
    }));

    return NextResponse.json(karigarsWithBalance);
  } catch (error) {
    console.error("Failed to fetch karigars:", error);
    return NextResponse.json(
      { error: "Failed to fetch karigars" },
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
    const { name, phone, specialization, address, wastageAllowancePercent } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { error: "name and phone are required" },
        { status: 400 }
      );
    }

    // Check uniqueness of phone within org
    const existing = await prisma.karigar.findUnique({
      where: {
        organizationId_phone: { organizationId, phone },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A karigar with this phone number already exists" },
        { status: 409 }
      );
    }

    const karigar = await prisma.karigar.create({
      data: {
        organizationId,
        name,
        phone,
        specialization: specialization || null,
        address: address || null,
        wastageAllowancePercent:
          wastageAllowancePercent !== undefined ? Number(wastageAllowancePercent) : 3.0,
      },
    });

    return NextResponse.json(
      {
        ...karigar,
        runningBalance: 0,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create karigar:", error);
    return NextResponse.json(
      { error: "Failed to create karigar" },
      { status: 500 }
    );
  }
}
