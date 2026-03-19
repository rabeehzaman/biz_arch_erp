import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isJewelleryModuleEnabled } from "@/lib/auth-utils";

export async function POST(
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
    const { id: schemeId } = await params;
    const body = await request.json();
    const { amount, paymentMethod, reference, notes } = body;

    if (amount === undefined || amount === null) {
      return NextResponse.json(
        { error: "amount is required" },
        { status: 400 }
      );
    }

    const numAmount = Number(amount);
    if (numAmount <= 0) {
      return NextResponse.json(
        { error: "amount must be greater than 0" },
        { status: 400 }
      );
    }

    // Use transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Verify scheme belongs to org and is active
      const scheme = await tx.customerScheme.findFirst({
        where: { id: schemeId, organizationId },
        include: {
          _count: {
            select: { payments: true },
          },
        },
      });

      if (!scheme) {
        throw new Error("SCHEME_NOT_FOUND");
      }

      if (scheme.status !== "ACTIVE") {
        throw new Error("SCHEME_NOT_ACTIVE");
      }

      const monthNumber = scheme._count.payments + 1;

      // Create payment
      const payment = await tx.schemePayment.create({
        data: {
          organizationId,
          schemeId,
          amount: numAmount,
          monthNumber,
          paymentMethod: paymentMethod || "CASH",
          reference: reference || null,
          notes: notes || null,
        },
      });

      // Update scheme totalPaid
      await tx.customerScheme.update({
        where: { id: schemeId },
        data: {
          totalPaid: { increment: numAmount },
        },
      });

      return payment;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "SCHEME_NOT_FOUND") {
        return NextResponse.json({ error: "Scheme not found" }, { status: 404 });
      }
      if (error.message === "SCHEME_NOT_ACTIVE") {
        return NextResponse.json(
          { error: "Payments can only be recorded for ACTIVE schemes" },
          { status: 400 }
        );
      }
    }
    console.error("Failed to record scheme payment:", error);
    return NextResponse.json(
      { error: "Failed to record scheme payment" },
      { status: 500 }
    );
  }
}
