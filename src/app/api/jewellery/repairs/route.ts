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
    const status = searchParams.get("status");
    const customerId = searchParams.get("customerId");

    const where: Record<string, unknown> = { organizationId };

    if (status) where.status = status;
    if (customerId) where.customerId = customerId;

    const repairs = await prisma.jewelleryRepair.findMany({
      where,
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        karigar: {
          select: { id: true, name: true, phone: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(repairs);
  } catch (error) {
    console.error("Failed to fetch repairs:", error);
    return NextResponse.json(
      { error: "Failed to fetch repairs" },
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
    const {
      customerId,
      itemDescription,
      repairType,
      estimatedWeight,
      materialPurity,
      karigarId,
      estimatedCost,
      notes,
      photoUrls,
    } = body;

    if (!customerId || !itemDescription) {
      return NextResponse.json(
        { error: "customerId and itemDescription are required" },
        { status: 400 }
      );
    }

    // Validate customer belongs to this org
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, organizationId },
      select: { id: true },
    });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Validate karigar belongs to this org if provided
    if (karigarId) {
      const karigar = await prisma.karigar.findFirst({
        where: { id: karigarId, organizationId },
        select: { id: true },
      });
      if (!karigar) {
        return NextResponse.json({ error: "Karigar not found" }, { status: 404 });
      }
    }

    // Use transaction to avoid repair number race condition
    const repair = await prisma.$transaction(async (tx) => {
      const lastRepair = await tx.jewelleryRepair.findFirst({
        where: { organizationId },
        orderBy: { repairNumber: "desc" },
        select: { repairNumber: true },
      });

      let nextNumber = 1;
      if (lastRepair?.repairNumber) {
        const match = lastRepair.repairNumber.match(/RPR-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }
      const repairNumber = `RPR-${String(nextNumber).padStart(4, "0")}`;

      return tx.jewelleryRepair.create({
        data: {
          organizationId,
          repairNumber,
          customerId,
          itemDescription,
          repairType: repairType || null,
          estimatedWeight: estimatedWeight !== undefined ? Number(estimatedWeight) : null,
          materialPurity: materialPurity || null,
          karigarId: karigarId || null,
          estimatedCost: estimatedCost !== undefined ? Number(estimatedCost) : null,
          notes: notes || null,
          photoUrls: photoUrls || [],
        },
        include: {
          customer: {
            select: { id: true, name: true, phone: true },
          },
          karigar: {
            select: { id: true, name: true, phone: true },
          },
        },
      });
    });

    return NextResponse.json(repair, { status: 201 });
  } catch (error) {
    console.error("Failed to create repair:", error);
    return NextResponse.json(
      { error: "Failed to create repair" },
      { status: 500 }
    );
  }
}
