import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);

    const products = await prisma.product.findMany({
      where: { isActive: true, organizationId },
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
