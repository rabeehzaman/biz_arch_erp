import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;

    const conversions = await prisma.productUnitConversion.findMany({
      where: { productId: id, organizationId },
      select: {
        id: true,
        unitId: true,
        unit: { select: { id: true, name: true, code: true } },
        conversionFactor: true,
        barcode: true,
        price: true,
        isDefaultUnit: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(conversions);
  } catch (error) {
    console.error("Failed to fetch product unit conversions:", error);
    return NextResponse.json(
      { error: "Failed to fetch unit conversions" },
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

    const organizationId = getOrgId(session);
    const { id } = await params;
    const { conversions } = await request.json();

    if (!Array.isArray(conversions)) {
      return NextResponse.json(
        { error: "conversions must be an array" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Delete existing conversions
      await tx.productUnitConversion.deleteMany({
        where: { productId: id, organizationId },
      });

      // Create new conversions
      for (const uc of conversions) {
        if (uc.unitId && uc.conversionFactor > 0) {
          await tx.productUnitConversion.create({
            data: {
              productId: id,
              unitId: uc.unitId,
              conversionFactor: uc.conversionFactor,
              barcode: uc.barcode || null,
              price: uc.price != null ? uc.price : null,
              isDefaultUnit: uc.isDefaultUnit ?? false,
              organizationId,
            },
          });
        }
      }

      return tx.productUnitConversion.findMany({
        where: { productId: id, organizationId },
        select: {
          id: true,
          unitId: true,
          unit: { select: { id: true, name: true, code: true } },
          conversionFactor: true,
          barcode: true,
          price: true,
        },
        orderBy: { createdAt: "asc" },
      });
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to update product unit conversions:", error);
    return NextResponse.json(
      { error: "Failed to update unit conversions" },
      { status: 500 }
    );
  }
}
