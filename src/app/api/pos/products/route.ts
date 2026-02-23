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
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
      include: {
        category: { select: { id: true, name: true, slug: true, color: true } },
        unit: { select: { code: true, name: true } },
        stockLots: {
          where: { remainingQuantity: { gt: 0 } },
          select: { remainingQuantity: true },
        },
      },
    });

    const result = products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      price: p.price,
      categoryId: p.categoryId,
      category: p.category,
      unit: p.unit,
      isService: p.isService,
      stockQuantity: p.stockLots.reduce(
        (sum, lot) => sum + Number(lot.remainingQuantity),
        0
      ),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch POS products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
