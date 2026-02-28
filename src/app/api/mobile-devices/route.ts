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
    const status = searchParams.get("status");
    const brand = searchParams.get("brand");
    const search = searchParams.get("search");
    const productId = searchParams.get("productId");

    const where: Record<string, unknown> = { organizationId };
    if (status) where.currentStatus = status;
    if (brand) where.brand = brand;
    if (productId) where.productId = productId;
    if (search) {
      where.OR = [
        { imei1: { contains: search, mode: "insensitive" } },
        { imei2: { contains: search, mode: "insensitive" } },
        { brand: { contains: search, mode: "insensitive" } },
        { model: { contains: search, mode: "insensitive" } },
        { serialNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    const devices = await prisma.mobileDevice.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, sku: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(devices);
  } catch (error) {
    console.error("Failed to fetch mobile devices:", error);
    return NextResponse.json(
      { error: "Failed to fetch mobile devices" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isMobileShopModuleEnabled(session)) {
      return NextResponse.json({ error: "Mobile Shop module is not enabled" }, { status: 403 });
    }

    const organizationId = getOrgId(session);
    const body = await request.json();
    const {
      imei1, imei2, serialNumber, brand, model, color,
      storageCapacity, ram, networkStatus, conditionGrade,
      batteryHealthPercentage, includedAccessories,
      productId, supplierId, costPrice, landedCost, sellingPrice,
      supplierWarrantyExpiry, customerWarrantyExpiry, notes,
    } = body;

    if (!imei1 || !brand || !model || !supplierId || costPrice === undefined) {
      return NextResponse.json(
        { error: "IMEI 1, brand, model, supplier, and cost price are required" },
        { status: 400 }
      );
    }

    // Validate IMEI format (15-digit numeric)
    if (!/^\d{15}$/.test(imei1)) {
      return NextResponse.json(
        { error: "IMEI 1 must be exactly 15 digits" },
        { status: 400 }
      );
    }
    if (imei2 && !/^\d{15}$/.test(imei2)) {
      return NextResponse.json(
        { error: "IMEI 2 must be exactly 15 digits" },
        { status: 400 }
      );
    }

    // Check uniqueness
    const existing = await prisma.mobileDevice.findUnique({
      where: { organizationId_imei1: { organizationId, imei1 } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A device with this IMEI already exists" },
        { status: 409 }
      );
    }

    // Create device + optional ADJUSTMENT stock lot in a transaction
    const device = await prisma.$transaction(async (tx) => {
      const newDevice = await tx.mobileDevice.create({
        data: {
          organizationId,
          imei1,
          imei2: imei2 || null,
          serialNumber: serialNumber || null,
          brand,
          model,
          color: color || null,
          storageCapacity: storageCapacity || null,
          ram: ram || null,
          networkStatus: networkStatus || "UNLOCKED",
          conditionGrade: conditionGrade || "NEW",
          batteryHealthPercentage: batteryHealthPercentage ?? null,
          includedAccessories: includedAccessories || null,
          productId: productId || null,
          supplierId,
          costPrice,
          landedCost: landedCost || 0,
          sellingPrice: sellingPrice || 0,
          supplierWarrantyExpiry: supplierWarrantyExpiry ? new Date(supplierWarrantyExpiry) : null,
          customerWarrantyExpiry: customerWarrantyExpiry ? new Date(customerWarrantyExpiry) : null,
          notes: notes || null,
        },
        include: {
          supplier: { select: { id: true, name: true } },
          product: { select: { id: true, name: true } },
        },
      });

      // If product is linked, create ADJUSTMENT stock lot to keep FIFO in sync
      if (productId) {
        await tx.stockLot.create({
          data: {
            organizationId,
            productId,
            sourceType: "ADJUSTMENT",
            lotDate: new Date(),
            unitCost: costPrice,
            initialQuantity: 1,
            remainingQuantity: 1,
          },
        });
      }

      return newDevice;
    });

    return NextResponse.json(device, { status: 201 });
  } catch (error) {
    console.error("Failed to create mobile device:", error);
    return NextResponse.json(
      { error: "Failed to create mobile device" },
      { status: 500 }
    );
  }
}
