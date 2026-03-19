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

    const scheme = await prisma.customerScheme.findFirst({
      where: { id, organizationId },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, email: true },
        },
        payments: {
          orderBy: { monthNumber: "asc" },
        },
      },
    });

    if (!scheme) {
      return NextResponse.json({ error: "Scheme not found" }, { status: 404 });
    }

    const totalExpected = Number(scheme.monthlyAmount) * scheme.durationMonths;
    const totalPaid = Number(scheme.totalPaid);
    const remainingAmount = totalExpected - totalPaid;
    const monthsPaid = scheme.payments.length;
    const monthsRemaining = scheme.durationMonths - monthsPaid;
    const maturityValue =
      Number(scheme.monthlyAmount) * (scheme.durationMonths + scheme.bonusMonths);

    return NextResponse.json({
      ...scheme,
      maturityInfo: {
        totalExpected,
        totalPaid,
        remainingAmount,
        monthsPaid,
        monthsRemaining,
        maturityValue,
        bonusAmount: Number(scheme.monthlyAmount) * scheme.bonusMonths,
        isMatured: totalPaid >= totalExpected,
      },
    });
  } catch (error) {
    console.error("Failed to fetch scheme:", error);
    return NextResponse.json(
      { error: "Failed to fetch scheme" },
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

    const existing = await prisma.customerScheme.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Scheme not found" }, { status: 404 });
    }

    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { error: "status is required" },
        { status: 400 }
      );
    }

    // Only allow transitions from ACTIVE
    if (existing.status !== "ACTIVE") {
      return NextResponse.json(
        { error: `Cannot update scheme in ${existing.status} status. Only ACTIVE schemes can be updated.` },
        { status: 400 }
      );
    }

    const validTransitions = ["COMPLETED", "WITHDRAWN", "DEFAULTED"];
    if (!validTransitions.includes(status)) {
      return NextResponse.json(
        {
          error: `Invalid status transition. Allowed: ${validTransitions.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const scheme = await prisma.customerScheme.update({
      where: { id },
      data: { status },
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    return NextResponse.json(scheme);
  } catch (error) {
    console.error("Failed to update scheme:", error);
    return NextResponse.json(
      { error: "Failed to update scheme" },
      { status: 500 }
    );
  }
}
