import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { SAUDI_VAT_RATE } from "@/lib/saudi-vat/constants";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);

    // Check if org uses Saudi VAT
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { saudiEInvoiceEnabled: true },
    });
    const isSaudi = org?.saudiEInvoiceEnabled || false;

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
      barcode: p.barcode,
      price: p.price,
      gstRate: isSaudi ? SAUDI_VAT_RATE : (Number(p.gstRate) || 0),
      hsnCode: p.hsnCode || null,
      categoryId: p.categoryId,
      category: p.category,
      unit: p.unit,
      isService: p.isService,
      weighMachineCode: p.weighMachineCode || null,
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
