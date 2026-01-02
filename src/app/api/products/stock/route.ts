import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: {
        stockLots: {
          where: { remainingQuantity: { gt: 0 } },
          select: {
            id: true,
            remainingQuantity: true,
            unitCost: true,
          },
        },
      },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error("Failed to fetch product stock:", error);
    return NextResponse.json(
      { error: "Failed to fetch product stock" },
      { status: 500 }
    );
  }
}
