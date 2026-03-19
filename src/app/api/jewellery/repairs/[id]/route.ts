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

    const repair = await prisma.jewelleryRepair.findFirst({
      where: { id, organizationId },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, email: true },
        },
        karigar: {
          select: { id: true, name: true, phone: true, specialization: true },
        },
      },
    });

    if (!repair) {
      return NextResponse.json({ error: "Repair not found" }, { status: 404 });
    }

    return NextResponse.json(repair);
  } catch (error) {
    console.error("Failed to fetch repair:", error);
    return NextResponse.json(
      { error: "Failed to fetch repair" },
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

    const existing = await prisma.jewelleryRepair.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Repair not found" }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    // Basic field updates
    if (body.itemDescription !== undefined) updateData.itemDescription = body.itemDescription;
    if (body.repairType !== undefined) updateData.repairType = body.repairType || null;
    if (body.estimatedWeight !== undefined)
      updateData.estimatedWeight = body.estimatedWeight !== null ? Number(body.estimatedWeight) : null;
    if (body.materialUsedWeight !== undefined)
      updateData.materialUsedWeight =
        body.materialUsedWeight !== null ? Number(body.materialUsedWeight) : null;
    if (body.materialPurity !== undefined) updateData.materialPurity = body.materialPurity || null;
    if (body.karigarId !== undefined) updateData.karigarId = body.karigarId || null;
    if (body.estimatedCost !== undefined)
      updateData.estimatedCost = body.estimatedCost !== null ? Number(body.estimatedCost) : null;
    if (body.actualCost !== undefined)
      updateData.actualCost = body.actualCost !== null ? Number(body.actualCost) : null;
    if (body.notes !== undefined) updateData.notes = body.notes || null;
    if (body.photoUrls !== undefined) updateData.photoUrls = body.photoUrls;

    // Handle status transitions with timestamp updates
    if (body.status !== undefined && body.status !== existing.status) {
      const newStatus = body.status;
      const currentStatus = existing.status;

      // Validate CANCELLED transition: only from RECEIVED or IN_PROGRESS
      if (newStatus === "CANCELLED") {
        if (currentStatus !== "RECEIVED" && currentStatus !== "IN_PROGRESS") {
          return NextResponse.json(
            {
              error: `Cannot cancel repair from ${currentStatus} status. Only RECEIVED or IN_PROGRESS repairs can be cancelled.`,
            },
            { status: 400 }
          );
        }
      }

      // Prevent backward transitions (except cancellation handled above)
      const statusOrder = ["RECEIVED", "IN_PROGRESS", "READY", "DELIVERED"];
      const currentIdx = statusOrder.indexOf(currentStatus);
      const newIdx = statusOrder.indexOf(newStatus);

      if (newStatus !== "CANCELLED" && currentStatus !== "CANCELLED") {
        if (newIdx !== -1 && currentIdx !== -1 && newIdx < currentIdx) {
          return NextResponse.json(
            { error: `Cannot transition from ${currentStatus} back to ${newStatus}` },
            { status: 400 }
          );
        }
      }

      updateData.status = newStatus;

      // Set timestamps based on new status
      if (newStatus === "READY") {
        updateData.completedDate = new Date();
      } else if (newStatus === "DELIVERED") {
        updateData.deliveredDate = new Date();
        // Also set completedDate if not already set
        if (!existing.completedDate) {
          updateData.completedDate = new Date();
        }
      }
    }

    const repair = await prisma.jewelleryRepair.update({
      where: { id },
      data: updateData,
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        karigar: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    return NextResponse.json(repair);
  } catch (error) {
    console.error("Failed to update repair:", error);
    return NextResponse.json(
      { error: "Failed to update repair" },
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

    const existing = await prisma.jewelleryRepair.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Repair not found" }, { status: 404 });
    }

    if (existing.status !== "RECEIVED") {
      return NextResponse.json(
        { error: "Can only delete repairs in RECEIVED status" },
        { status: 400 }
      );
    }

    await prisma.jewelleryRepair.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete repair:", error);
    return NextResponse.json(
      { error: "Failed to delete repair" },
      { status: 500 }
    );
  }
}
