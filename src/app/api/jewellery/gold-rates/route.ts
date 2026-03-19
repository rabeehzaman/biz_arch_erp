import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isJewelleryModuleEnabled } from "@/lib/auth-utils";

const PURITY_MULTIPLIERS: Record<string, number> = {
  K24: 1.0,
  K22: 22 / 24,
  K21: 21 / 24,
  K18: 18 / 24,
  K14: 14 / 24,
  K9: 9 / 24,
};

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
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const purity = searchParams.get("purity");
    const metalType = searchParams.get("metalType");

    const where: Record<string, unknown> = { organizationId };

    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) dateFilter.lte = new Date(to);
      where.date = dateFilter;
    }

    if (purity) where.purity = purity;
    if (metalType) where.metalType = metalType;

    const rates = await prisma.goldRate.findMany({
      where,
      orderBy: { date: "desc" },
    });

    return NextResponse.json(rates);
  } catch (error) {
    console.error("Failed to fetch gold rates:", error);
    return NextResponse.json(
      { error: "Failed to fetch gold rates" },
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
    const { date, metalType, purity, sellRate } = body;

    if (!date || !purity || sellRate === undefined) {
      return NextResponse.json(
        { error: "date, purity, and sellRate are required" },
        { status: 400 }
      );
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        jewelleryBuyRateSpread: true,
        jewelleryAutoDerivePurities: true,
        jewelleryEnabledPurities: true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const spread = Number(org.jewelleryBuyRateSpread ?? 5);
    const rateDate = new Date(date);
    const metal = metalType || "GOLD";
    const numericSellRate = Number(sellRate);
    const buyRate = numericSellRate * (1 - spread / 100);

    // Determine which purities to upsert
    const puritiesToUpsert: { purity: string; sellRate: number; buyRate: number }[] = [];

    if (org.jewelleryAutoDerivePurities && purity === "K24") {
      // Auto-derive rates for all enabled purities from the K24 rate
      const enabledPurities = org.jewelleryEnabledPurities ?? ["K24", "K22", "K21", "K18"];
      for (const p of enabledPurities) {
        const multiplier = PURITY_MULTIPLIERS[p] ?? 1.0;
        const derivedSell = Math.round(numericSellRate * multiplier * 100) / 100;
        const derivedBuy = Math.round(derivedSell * (1 - spread / 100) * 100) / 100;
        puritiesToUpsert.push({ purity: p, sellRate: derivedSell, buyRate: derivedBuy });
      }
    } else {
      puritiesToUpsert.push({ purity, sellRate: numericSellRate, buyRate: Math.round(buyRate * 100) / 100 });
    }

    // Upsert all rates
    const results = await prisma.$transaction(
      puritiesToUpsert.map(({ purity: p, sellRate: sr, buyRate: br }) =>
        prisma.goldRate.upsert({
          where: {
            organizationId_date_purity_metalType: {
              organizationId,
              date: rateDate,
              purity: p,
              metalType: metal,
            },
          },
          create: {
            organizationId,
            date: rateDate,
            metalType: metal,
            purity: p,
            sellRate: sr,
            buyRate: br,
          },
          update: {
            sellRate: sr,
            buyRate: br,
          },
        })
      )
    );

    return NextResponse.json(results, { status: 201 });
  } catch (error) {
    console.error("Failed to create gold rate:", error);
    return NextResponse.json(
      { error: "Failed to create gold rate" },
      { status: 500 }
    );
  }
}
