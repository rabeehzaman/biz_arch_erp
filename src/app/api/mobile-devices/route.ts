import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isMobileShopModuleEnabled } from "@/lib/auth-utils";
import { createAutoJournalEntry, getSystemAccount } from "@/lib/accounting/journal";
import { isBackdated, hasZeroCOGSItems, recalculateFromDate } from "@/lib/inventory/fifo";

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
      productId, supplierId, costPrice, mrp, landedCost, sellingPrice,
      supplierWarrantyExpiry, customerWarrantyExpiry, notes, photoUrls,
      createProduct, productName, categoryId, unitId, hsnCode, gstRate, warehouseId,
    } = body;

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { multiBranchEnabled: true },
    });

    if (org?.multiBranchEnabled && !warehouseId) {
      return NextResponse.json(
        { error: "Warehouse is required when multi-branch is enabled" },
        { status: 400 }
      );
    }

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

    // Create device + optional product + optional OPENING_BALANCE stock lot in a transaction
    const device = await prisma.$transaction(async (tx) => {
      let finalProductId = productId || null;

      if (createProduct && productName) {
        const newProduct = await tx.product.create({
          data: {
            organizationId,
            name: productName,
            price: sellingPrice || 0,
            cost: costPrice,
            unitId: unitId || null,
            categoryId: categoryId || null,
            hsnCode: hsnCode || null,
            gstRate: gstRate || 0,
            isImeiTracked: true,
          }
        });
        finalProductId = newProduct.id;
      }

      let openingStockIdStr = null;

      // If product is linked, create Opening Stock lot FIRST
      if (finalProductId) {
        // Use start-of-day so the lot is available for same-day invoices
        // (invoice dates are midnight UTC, so a lot created at e.g. 10:30 UTC
        // would be "after" a same-day invoice date and excluded by FIFO)
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        const openingStock = await tx.openingStock.create({
          data: {
            productId: finalProductId,
            quantity: 1,
            unitCost: costPrice,
            stockDate: today,
            notes: `Created from Mobile Shop - IMEI: ${imei1}`,
            organizationId,
            warehouseId: warehouseId || null,
          },
          include: { product: true }
        });
        openingStockIdStr = openingStock.id;

        await tx.stockLot.create({
          data: {
            organizationId,
            productId: finalProductId,
            sourceType: "OPENING_STOCK",
            openingStockId: openingStock.id,
            lotDate: today,
            unitCost: costPrice,
            initialQuantity: 1,
            remainingQuantity: 1,
            warehouseId: warehouseId || null,
          },
        });

        if (costPrice > 0) {
          const inventoryAccount = await getSystemAccount(tx, organizationId, "1400");
          const ownerCapitalAccount = await getSystemAccount(tx, organizationId, "3100");
          if (inventoryAccount && ownerCapitalAccount) {
            await createAutoJournalEntry(tx, organizationId, {
              date: today,
              description: `Opening Stock - ${openingStock.product.name} (IMEI: ${imei1})`,
              sourceType: "OPENING_BALANCE",
              sourceId: openingStock.id,
              lines: [
                { accountId: inventoryAccount.id, description: "Inventory", debit: costPrice, credit: 0 },
                { accountId: ownerCapitalAccount.id, description: "Opening Balance Equity", debit: 0, credit: costPrice },
              ],
            });
          }
        }

        const backdated = await isBackdated(finalProductId, today, tx);
        const zeroCOGSDate = await hasZeroCOGSItems(finalProductId, tx);

        if (backdated) {
          await recalculateFromDate(finalProductId, today, tx, "backdated_mobile_device_stock", undefined, organizationId);
        } else if (zeroCOGSDate) {
          await recalculateFromDate(finalProductId, zeroCOGSDate, tx, "zero_cogs_fix_mobile_device", undefined, organizationId);
        }
      }

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
          productId: finalProductId,
          supplierId,
          costPrice,
          mrp: mrp || 0,
          landedCost: landedCost || 0,
          sellingPrice: sellingPrice || 0,
          supplierWarrantyExpiry: supplierWarrantyExpiry ? new Date(supplierWarrantyExpiry) : null,
          customerWarrantyExpiry: customerWarrantyExpiry ? new Date(customerWarrantyExpiry) : null,
          notes: notes || null,
          photoUrls: Array.isArray(photoUrls) ? photoUrls : [],
          openingStockId: openingStockIdStr,
        },
        include: {
          supplier: { select: { id: true, name: true } },
          product: { select: { id: true, name: true } },
        },
      });

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
