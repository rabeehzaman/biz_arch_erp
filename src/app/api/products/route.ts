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

      if (isImeiTracked && deviceDetails) {
        const {
          imei1, imei2, brand, model, color, storageCapacity, ram,
          networkStatus, conditionGrade, batteryHealthPercentage,
          supplierId, costPrice, landedCost, sellingPrice,
          supplierWarrantyExpiry, customerWarrantyExpiry, notes
        } = deviceDetails;

        if (imei1 && brand && model && supplierId) {
          const newDevice = await tx.mobileDevice.create({
            data: {
              organizationId,
              imei1,
              imei2: imei2 || null,
              brand,
              model,
              color: color || null,
              storageCapacity: storageCapacity || null,
              ram: ram || null,
              networkStatus: networkStatus || "UNLOCKED",
              conditionGrade: conditionGrade || "NEW",
              batteryHealthPercentage: batteryHealthPercentage ?? null,
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

          const openingStock = await tx.openingStock.create({
            data: {
              productId: newProduct.id,
              quantity: 1,
              unitCost: costPrice || 0,
              stockDate: new Date(),
              notes: "Created from Product Form",
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
              initialQuantity: 1,
              remainingQuantity: 1,
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
                  { accountId: inventoryAccount.id, description: "Inventory", debit: costPrice, credit: 0 },
                  { accountId: ownerCapitalAccount.id, description: "Opening Balance Equity", debit: 0, credit: costPrice },
                ],
              });
            }
          }
        }
      }

      return newProduct;
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Failed to create product:", error);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    );
  }
}
