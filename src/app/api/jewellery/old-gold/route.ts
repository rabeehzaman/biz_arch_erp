import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isJewelleryModuleEnabled } from "@/lib/auth-utils";
import { createMetalLedgerEntry } from "@/lib/jewellery/metal-ledger";

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
    const customerId = searchParams.get("customerId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const unadjusted = searchParams.get("unadjusted") === "true";

    const where: Record<string, unknown> = { organizationId };

    if (customerId) where.customerId = customerId;
    if (unadjusted) where.adjustedAgainstInvoiceId = null;

    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) dateFilter.lte = new Date(to);
      where.createdAt = dateFilter;
    }

    const purchases = await prisma.oldGoldPurchase.findMany({
      where,
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(purchases);
  } catch (error) {
    console.error("Failed to fetch old gold purchases:", error);
    return NextResponse.json(
      { error: "Failed to fetch old gold purchases" },
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
      customerName,
      weight,
      testedPurity,
      purityPercentage,
      testReadings,
      testMethod,
      meltingLossPercent,
      rate,
      adjustedAgainstInvoiceId,
      panNumber,
      notes,
    } = body;

    if (weight === undefined || purityPercentage === undefined || rate === undefined) {
      return NextResponse.json(
        { error: "weight, purityPercentage, and rate are required" },
        { status: 400 }
      );
    }

    const numWeight = Number(weight);
    const numPurity = Number(purityPercentage);
    const numRate = Number(rate);
    const numMelting = Number(meltingLossPercent ?? 0);

    const totalValue =
      Math.round(numWeight * (numPurity / 100) * numRate * (1 - numMelting / 100) * 100) / 100;

    // Fetch org settings to check PAN requirement
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        jewelleryPanRequired: true,
        jewelleryPanThreshold: true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (org.jewelleryPanRequired && totalValue > Number(org.jewelleryPanThreshold)) {
      if (!panNumber || panNumber.trim() === "") {
        return NextResponse.json(
          {
            error: `PAN number is required for old gold purchases exceeding ${org.jewelleryPanThreshold}`,
          },
          { status: 400 }
        );
      }
    }

    const purchase = await prisma.$transaction(async (tx) => {
      const record = await tx.oldGoldPurchase.create({
        data: {
          organizationId,
          customerId: customerId || null,
          customerName: customerName || null,
          weight: numWeight,
          testedPurity: testedPurity || "K22",
          purityPercentage: numPurity,
          testReadings: testReadings ?? null,
          testMethod: testMethod || "XRF",
          meltingLossPercent: numMelting,
          rate: numRate,
          totalValue,
          adjustedAgainstInvoiceId: adjustedAgainstInvoiceId || null,
          panNumber: panNumber || null,
          notes: notes || null,
        },
        include: {
          customer: {
            select: { id: true, name: true, phone: true },
          },
        },
      });

      // Metal ledger INFLOW for old gold received
      const ogPurity = testedPurity || "K22";
      const ogFineWeight = numWeight * (numPurity / 100);
      await createMetalLedgerEntry(tx, organizationId, {
        date: new Date(),
        metalType: "GOLD",
        purity: ogPurity,
        grossWeight: numWeight,
        fineWeight: Math.round(ogFineWeight * 1000) / 1000,
        direction: "INFLOW",
        description: `Old Gold Purchase - ${record.customerName || record.customer?.name || "Walk-in"} (${numWeight}g)`,
        sourceType: "OLD_GOLD_IN",
        sourceId: record.id,
        customerId: customerId || null,
        oldGoldPurchaseId: record.id,
      });

      return record;
    });

    return NextResponse.json(purchase, { status: 201 });
  } catch (error) {
    console.error("Failed to create old gold purchase:", error);
    return NextResponse.json(
      { error: "Failed to create old gold purchase" },
      { status: 500 }
    );
  }
}
