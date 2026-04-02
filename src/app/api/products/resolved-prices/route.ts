import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgId, checkSubscriptionForApi, getPriceListId } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";
import { resolveProductPrices } from "@/lib/price-list/resolve-price";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subCheck = await checkSubscriptionForApi(session);
  if (subCheck) return subCheck;

  const organizationId = getOrgId(session);
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");
  const userPriceListId = getPriceListId(session);

  if (!userPriceListId && !customerId) {
    return NextResponse.json({});
  }

  const products = await prisma.product.findMany({
    where: { organizationId, isActive: true },
    select: {
      id: true,
      price: true,
      jewelleryItem: { select: { id: true } },
    },
  });

  const mapped = products.map((p) => ({
    id: p.id,
    price: p.price,
    hasJewelleryItem: !!p.jewelleryItem,
  }));

  const resolved = await resolveProductPrices(mapped, {
    userId: session.user.id,
    userPriceListId,
    customerId,
    organizationId,
  });

  // Return only products whose price differs from base
  const result: Record<string, { price: number; basePrice: number; source: string; priceListName?: string }> = {};
  for (const [productId, rp] of resolved) {
    if (rp.source !== "base") {
      result[productId] = rp;
    }
  }

  return NextResponse.json(result);
}
