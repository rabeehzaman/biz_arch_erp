import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { createAutoJournalEntry, getSystemAccount } from "@/lib/accounting/journal";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { searchParams } = new URL(request.url);
    const excludeServices = searchParams.get("excludeServices") === "true";
    const warehouseId = searchParams.get("warehouseId");

    const products = await prisma.product.findMany({
      where: {
        organizationId,
        ...(excludeServices ? { isService: false } : {})
      },
      include: {
        unit: true,
        stockLots: {
          where: {
            remainingQuantity: { gt: 0 },
            ...(warehouseId ? { warehouseId } : {})
          },
          select: {
            remainingQuantity: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate available stock for each product
    const productsWithStock = products.map((product) => {
      const availableStock = product.stockLots.reduce(
        (sum: number, lot: any) => sum + Number(lot.remainingQuantity),
        0
      );
      return {
        ...product,
        availableStock,
      };
    });

    return NextResponse.json(productsWithStock);
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
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

    const organizationId = getOrgId(session);
    const body = await request.json();
    const { name, description, price, unitId, sku, barcode, isService, isImeiTracked, gstRate, hsnCode, deviceDetails } = body;

    if (!name || price === undefined) {
      return NextResponse.json(
        { error: "Name and price are required" },
        { status: 400 }
      );
    }

    if (!unitId) {
      return NextResponse.json(
        { error: "Unit is required" },
        { status: 400 }
      );
    }

    const VALID_GST_RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 7.5, 12, 18, 28];
    if (gstRate !== undefined && gstRate !== null && !VALID_GST_RATES.includes(Number(gstRate))) {
      return NextResponse.json(
        { error: `Invalid GST rate: ${gstRate}. Valid rates are: ${VALID_GST_RATES.join(", ")}` },
        { status: 400 }
      );
    }

    const product = await prisma.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
        data: {
          organizationId,
          name,
          description: description || null,
          price,
          unitId,
          sku: sku || null,
          barcode: barcode || null,
          isService: isService ?? false,
          isImeiTracked: isImeiTracked ?? false,
          hsnCode: hsnCode || null,
          gstRate: gstRate ?? 0,
        },
        include: {
          unit: true,
        },
      });

      // Deduce brand and model from product name
      const nameParts = name.trim().split(/\s+/);
      const deducedBrand = nameParts.length > 0 ? nameParts[0] : "Unknown";
      const deducedModel = nameParts.length > 1 ? nameParts.slice(1).join(" ") : name;

      if (isImeiTracked && deviceDetails) {
        const {
          devices,
          supplierId, costPrice, landedCost, sellingPrice,
          supplierWarrantyExpiry, customerWarrantyExpiry, notes
        } = deviceDetails;

        if (!supplierId) {
          throw new Error("SUPPLIER_REQUIRED");
        }

        if (devices && Array.isArray(devices) && devices.length > 0) {
          const quantity = devices.length;
          const totalCost = (costPrice || 0) * quantity;

          // Create all mobile devices with per-device specs
          for (const device of devices) {
            await tx.mobileDevice.create({
              data: {
                organizationId,
                imei1: device.imei,
                brand: deducedBrand,
                model: deducedModel,
                color: device.color || null,
                storageCapacity: device.storageCapacity || null,
                ram: device.ram || null,
                networkStatus: (device.networkStatus || "UNLOCKED") as any,
                conditionGrade: (device.conditionGrade || "NEW") as any,
                batteryHealthPercentage: device.batteryHealthPercentage ?? null,
                productId: newProduct.id,
                supplierId,
                costPrice: costPrice || 0,
                landedCost: landedCost || 0,
                sellingPrice: sellingPrice || price || 0,
                supplierWarrantyExpiry: supplierWarrantyExpiry ? new Date(supplierWarrantyExpiry) : null,
                customerWarrantyExpiry: customerWarrantyExpiry ? new Date(customerWarrantyExpiry) : null,
                notes: notes || null,
              },
            });
          }

          const openingStock = await tx.openingStock.create({
            data: {
              productId: newProduct.id,
              quantity: quantity,
              unitCost: costPrice || 0,
              stockDate: new Date(),
              notes: `Created from Product Form (${quantity} devices)`,
              organizationId,
            },
          });

          await tx.stockLot.create({
            data: {
              organizationId,
              productId: newProduct.id,
              sourceType: "OPENING_STOCK",
              openingStockId: openingStock.id,
              lotDate: new Date(),
              unitCost: costPrice || 0,
              initialQuantity: quantity,
              remainingQuantity: quantity,
            },
          });

          if ((costPrice || 0) > 0) {
            const inventoryAccount = await getSystemAccount(tx, organizationId, "1400");
            const ownerCapitalAccount = await getSystemAccount(tx, organizationId, "3100");
            if (inventoryAccount && ownerCapitalAccount) {
              await createAutoJournalEntry(tx, organizationId, {
                date: new Date(),
                description: `Opening Stock - ${newProduct.name}`,
                sourceType: "OPENING_STOCK",
                sourceId: openingStock.id,
                lines: [
                  { accountId: inventoryAccount.id, description: "Inventory", debit: totalCost, credit: 0 },
                  { accountId: ownerCapitalAccount.id, description: "Opening Balance Equity", debit: 0, credit: totalCost },
                ],
              });
            }
          }
        } else {
          throw new Error("DEVICES_REQUIRED");
        }
      }

      return newProduct;
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create product:", error);

    let errorMessage = "Failed to create product";
    let statusCode = 500;

    if (error.code === 'P2002') {
      statusCode = 400;
      if (error.meta?.target?.includes('imei1')) {
        errorMessage = "One or more IMEIs already exist in the database.";
      } else {
        errorMessage = "A product with this SKU or Barcode already exists.";
      }
    } else if (error.code === 'P2003') {
      statusCode = 400;
      errorMessage = "Invalid supplier selected.";
    } else if (error.message === "SUPPLIER_REQUIRED") {
      statusCode = 400;
      errorMessage = "Supplier is required when tracking by IMEI.";
    } else if (error.message === "DEVICES_REQUIRED") {
      statusCode = 400;
      errorMessage = "At least one device with IMEI is required when tracking by IMEI.";
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}
