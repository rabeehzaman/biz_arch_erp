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

    if (!imei || imei.trim().length < 4) {
      return NextResponse.json({ error: "IMEI parameter is required (minimum 4 characters)" }, { status: 400 });
    }

    const search = imei.trim();
    const isExact = /^\d{15}$/.test(search);

    const includeRelations = {
      supplier: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, sku: true } },
      purchaseInvoice: { select: { id: true, purchaseInvoiceNumber: true } },
      salesInvoice: { select: { id: true, invoiceNumber: true } },
      salesperson: { select: { id: true, name: true } },
    };

    if (isExact) {
      // Full 15-digit IMEI: exact match, return single device
      const device = await prisma.mobileDevice.findFirst({
        where: {
          organizationId,
          OR: [
            { imei1: search },
            { imei2: search },
          ],
        },
        include: includeRelations,
      });

      if (!device) {
        return NextResponse.json({ error: "Device not found" }, { status: 404 });
      }

      return NextResponse.json(device);
    }

    // Partial IMEI: contains search, return multiple devices
    const devices = await prisma.mobileDevice.findMany({
      where: {
        organizationId,
        OR: [
          { imei1: { contains: search, mode: "insensitive" } },
          { imei2: { contains: search, mode: "insensitive" } },
          { serialNumber: { contains: search, mode: "insensitive" } },
        ],
      },
      include: includeRelations,
      take: 20,
      orderBy: { createdAt: "desc" },
    });

    if (devices.length === 0) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    // Single match: return as single device for backward compat
    if (devices.length === 1) {
      return NextResponse.json(devices[0]);
    }

    // Multiple matches: return array
    return NextResponse.json({ devices });
  } catch (error) {
    console.error("Failed to lookup mobile device:", error);
    return NextResponse.json(
      { error: "Failed to lookup mobile device" },
      { status: 500 }
    );
  }
}
