import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isJewelleryModuleEnabled } from "@/lib/auth-utils";

export async function GET(
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

    const karigar = await prisma.karigar.findFirst({
      where: { id, organizationId },
      include: {
        transactions: {
          orderBy: { date: "desc" },
          take: 50,
          include: {
            jewelleryItem: {
              select: { id: true, tagNumber: true, purity: true },
            },
          },
        },
      },
    });

    if (!karigar) {
      return NextResponse.json({ error: "Karigar not found" }, { status: 404 });
    }

    const runningBalance =
      Number(karigar.goldIssuedWeight) -
      Number(karigar.goldReturnedWeight) -
      Number(karigar.scrapReturnedWeight);

    return NextResponse.json({
      ...karigar,
      runningBalance,
      balances: {
        goldIssuedWeight: Number(karigar.goldIssuedWeight),
        goldReturnedWeight: Number(karigar.goldReturnedWeight),
        scrapReturnedWeight: Number(karigar.scrapReturnedWeight),
        netOutstanding: runningBalance,
      },
    });
  } catch (error) {
    console.error("Failed to fetch karigar:", error);
    return NextResponse.json(
      { error: "Failed to fetch karigar" },
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

    if (!isJewelleryModuleEnabled(session)) {
      return NextResponse.json({ error: "Jewellery module is not enabled" }, { status: 403 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;

    const existing = await prisma.karigar.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Karigar not found" }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.phone !== undefined) {
      // Check uniqueness if phone is changing
      if (body.phone !== existing.phone) {
        const phoneExists = await prisma.karigar.findUnique({
          where: {
            organizationId_phone: { organizationId, phone: body.phone },
          },
        });
        if (phoneExists) {
          return NextResponse.json(
            { error: "A karigar with this phone number already exists" },
            { status: 409 }
          );
        }
      }
      updateData.phone = body.phone;
    }
    if (body.specialization !== undefined) updateData.specialization = body.specialization || null;
    if (body.address !== undefined) updateData.address = body.address || null;
    if (body.wastageAllowancePercent !== undefined)
      updateData.wastageAllowancePercent = Number(body.wastageAllowancePercent);
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const karigar = await prisma.karigar.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      ...karigar,
      runningBalance:
        Number(karigar.goldIssuedWeight) -
        Number(karigar.goldReturnedWeight) -
        Number(karigar.scrapReturnedWeight),
    });
  } catch (error) {
    console.error("Failed to update karigar:", error);
    return NextResponse.json(
      { error: "Failed to update karigar" },
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

    const karigar = await prisma.karigar.findFirst({
      where: { id, organizationId },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });

    if (!karigar) {
      return NextResponse.json({ error: "Karigar not found" }, { status: 404 });
    }

    if (karigar._count.transactions > 0) {
      // Soft-delete by deactivating
      await prisma.karigar.update({
        where: { id },
        data: { isActive: false },
      });

      return NextResponse.json({
        success: true,
        softDeleted: true,
        message: "Karigar deactivated because transactions exist",
      });
    }

    await prisma.karigar.delete({ where: { id } });

    return NextResponse.json({ success: true, softDeleted: false });
  } catch (error) {
    console.error("Failed to delete karigar:", error);
    return NextResponse.json(
      { error: "Failed to delete karigar" },
      { status: 500 }
    );
  }
}
