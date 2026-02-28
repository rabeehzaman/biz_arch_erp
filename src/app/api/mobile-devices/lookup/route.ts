import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isMobileShopModuleEnabled } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isMobileShopModuleEnabled(session)) {
      return NextResponse.json({ error: "Mobile Shop module is not enabled" }, { status: 403 });
    }

    const organizationId = getOrgId(session);
    const { searchParams } = new URL(request.url);
    const imei = searchParams.get("imei");

    if (!imei) {
      return NextResponse.json({ error: "IMEI parameter is required" }, { status: 400 });
    }

    const device = await prisma.mobileDevice.findFirst({
      where: {
        organizationId,
        OR: [
          { imei1: imei },
          { imei2: imei },
        ],
      },
      include: {
        supplier: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, sku: true } },
        purchaseInvoice: { select: { id: true, purchaseInvoiceNumber: true } },
        salesInvoice: { select: { id: true, invoiceNumber: true } },
        salesperson: { select: { id: true, name: true } },
      },
    });

    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    return NextResponse.json(device);
  } catch (error) {
    console.error("Failed to lookup mobile device:", error);
    return NextResponse.json(
      { error: "Failed to lookup mobile device" },
      { status: 500 }
    );
  }
}
