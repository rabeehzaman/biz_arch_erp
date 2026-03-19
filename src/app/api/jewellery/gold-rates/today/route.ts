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

    // Start of today (UTC midnight)
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    // Try to get today's rates
    let rates = await prisma.goldRate.findMany({
      where: {
        organizationId,
        date: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
      orderBy: { purity: "asc" },
    });

    // If no rates for today, get the most recent rates
    if (rates.length === 0) {
      const mostRecentRate = await prisma.goldRate.findFirst({
        where: { organizationId },
        orderBy: { date: "desc" },
        select: { date: true },
      });

      if (mostRecentRate) {
        const recentStart = new Date(mostRecentRate.date);
        recentStart.setUTCHours(0, 0, 0, 0);
        const recentEnd = new Date(recentStart.getTime() + 24 * 60 * 60 * 1000);

        rates = await prisma.goldRate.findMany({
          where: {
            organizationId,
            date: {
              gte: recentStart,
              lt: recentEnd,
            },
          },
          orderBy: { purity: "asc" },
        });
      }
    }

    return NextResponse.json(rates);
  } catch (error) {
    console.error("Failed to fetch today's gold rates:", error);
    return NextResponse.json(
      { error: "Failed to fetch today's gold rates" },
      { status: 500 }
    );
  }
}
