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

    const schemes = await prisma.customerScheme.findMany({
      where,
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        _count: {
          select: { payments: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(schemes);
  } catch (error) {
    console.error("Failed to fetch schemes:", error);
    return NextResponse.json(
      { error: "Failed to fetch schemes" },
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
    const { schemeName, customerId, monthlyAmount, durationMonths, startDate } = body;

    if (!schemeName || !customerId || !monthlyAmount || !durationMonths || !startDate) {
      return NextResponse.json(
        { error: "schemeName, customerId, monthlyAmount, durationMonths, and startDate are required" },
        { status: 400 }
      );
    }

    // Fetch org settings
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        jewellerySchemesEnabled: true,
        jewellerySchemeMaxDuration: true,
        jewellerySchemeEnforce365Days: true,
        jewellerySchemeBonusMonths: true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (!org.jewellerySchemesEnabled) {
      return NextResponse.json(
        { error: "Customer schemes are not enabled for this organization" },
        { status: 403 }
      );
    }

    const numDuration = Number(durationMonths);

    if (numDuration > org.jewellerySchemeMaxDuration) {
      return NextResponse.json(
        {
          error: `Duration exceeds maximum allowed (${org.jewellerySchemeMaxDuration} months)`,
        },
        { status: 400 }
      );
    }

    // Calculate end date: startDate + durationMonths months
    const start = new Date(startDate);
    const endDate = new Date(start);
    endDate.setMonth(endDate.getMonth() + numDuration);

    // Enforce 365-day limit if enabled
    if (org.jewellerySchemeEnforce365Days) {
      const diffMs = endDate.getTime() - start.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays > 365) {
        return NextResponse.json(
          { error: "Scheme duration cannot exceed 365 days" },
          { status: 400 }
        );
      }
    }

    const bonusMonths = org.jewellerySchemeBonusMonths;

    const scheme = await prisma.customerScheme.create({
      data: {
        organizationId,
        schemeName,
        customerId,
        monthlyAmount: Number(monthlyAmount),
        durationMonths: numDuration,
        bonusMonths,
        startDate: start,
        endDate,
      },
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        _count: {
          select: { payments: true },
        },
      },
    });

    return NextResponse.json(scheme, { status: 201 });
  } catch (error) {
    console.error("Failed to create scheme:", error);
    return NextResponse.json(
      { error: "Failed to create scheme" },
      { status: 500 }
    );
  }
}
