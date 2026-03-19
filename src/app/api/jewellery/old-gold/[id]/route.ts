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

    const purchase = await prisma.oldGoldPurchase.findFirst({
      where: { id, organizationId },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, email: true },
        },
      },
    });

    if (!purchase) {
      return NextResponse.json({ error: "Old gold purchase not found" }, { status: 404 });
    }

    return NextResponse.json(purchase);
  } catch (error) {
    console.error("Failed to fetch old gold purchase:", error);
    return NextResponse.json(
      { error: "Failed to fetch old gold purchase" },
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

    const existing = await prisma.oldGoldPurchase.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Old gold purchase not found" }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.customerId !== undefined) updateData.customerId = body.customerId || null;
    if (body.customerName !== undefined) updateData.customerName = body.customerName || null;
    if (body.testedPurity !== undefined) updateData.testedPurity = body.testedPurity;
    if (body.testReadings !== undefined) updateData.testReadings = body.testReadings;
    if (body.testMethod !== undefined) updateData.testMethod = body.testMethod;
    if (body.adjustedAgainstInvoiceId !== undefined)
      updateData.adjustedAgainstInvoiceId = body.adjustedAgainstInvoiceId || null;
    if (body.panNumber !== undefined) updateData.panNumber = body.panNumber || null;
    if (body.notes !== undefined) updateData.notes = body.notes || null;

    // Recalculate totalValue if any value-affecting fields changed
    const newWeight = body.weight !== undefined ? Number(body.weight) : Number(existing.weight);
    const newPurity =
      body.purityPercentage !== undefined
        ? Number(body.purityPercentage)
        : Number(existing.purityPercentage);
    const newRate = body.rate !== undefined ? Number(body.rate) : Number(existing.rate);
    const newMelting =
      body.meltingLossPercent !== undefined
        ? Number(body.meltingLossPercent)
        : Number(existing.meltingLossPercent);

    if (
      body.weight !== undefined ||
      body.purityPercentage !== undefined ||
      body.rate !== undefined ||
      body.meltingLossPercent !== undefined
    ) {
      updateData.weight = newWeight;
      updateData.purityPercentage = newPurity;
      updateData.rate = newRate;
      updateData.meltingLossPercent = newMelting;
      updateData.totalValue =
        Math.round(newWeight * (newPurity / 100) * newRate * (1 - newMelting / 100) * 100) / 100;
    }

    // Re-validate PAN requirement if totalValue changed
    if (updateData.totalValue !== undefined) {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { jewelleryPanRequired: true, jewelleryPanThreshold: true },
      });

      const finalTotalValue = Number(updateData.totalValue);
      const finalPan = body.panNumber !== undefined ? body.panNumber : existing.panNumber;

      if (org?.jewelleryPanRequired && finalTotalValue > Number(org.jewelleryPanThreshold)) {
        if (!finalPan || finalPan.trim() === "") {
          return NextResponse.json(
            { error: `PAN number is required for old gold purchases exceeding ${org.jewelleryPanThreshold}` },
            { status: 400 }
          );
        }
      }
    }

    const purchase = await prisma.oldGoldPurchase.update({
      where: { id },
      data: updateData,
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    return NextResponse.json(purchase);
  } catch (error) {
    console.error("Failed to update old gold purchase:", error);
    return NextResponse.json(
      { error: "Failed to update old gold purchase" },
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

    const existing = await prisma.oldGoldPurchase.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Old gold purchase not found" }, { status: 404 });
    }

    if (existing.adjustedAgainstInvoiceId) {
      return NextResponse.json(
        { error: "Cannot delete old gold purchase that is adjusted against an invoice" },
        { status: 400 }
      );
    }

    await prisma.oldGoldPurchase.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete old gold purchase:", error);
    return NextResponse.json(
      { error: "Failed to delete old gold purchase" },
      { status: 500 }
    );
  }
}
