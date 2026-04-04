import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const body = await request.json();
    const { unitId, conversionFactor, barcode, price, productIds } = body;

    if (!unitId || !conversionFactor || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: "unitId, conversionFactor, and productIds are required" },
        { status: 400 }
      );
    }

    if (Number(conversionFactor) <= 0) {
      return NextResponse.json(
        { error: "conversionFactor must be greater than 0" },
        { status: 400 }
      );
    }

    const result = await prisma.productUnitConversion.createMany({
      data: productIds.map((productId: string) => ({
        productId,
        unitId,
        conversionFactor,
        barcode: barcode || null,
        price: price != null ? price : null,
        organizationId,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({
      created: result.count,
      message: `Unit conversion applied to ${result.count} products`,
    });
  } catch (error) {
    console.error("Failed to bulk assign unit conversions:", error);
    return NextResponse.json(
      { error: "Failed to bulk assign unit conversions" },
      { status: 500 }
    );
  }
}
