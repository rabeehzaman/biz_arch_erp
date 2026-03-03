import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isMobileShopModuleEnabled } from "@/lib/auth-utils";
import { isBackdated, hasZeroCOGSItems, recalculateFromDate } from "@/lib/inventory/fifo";
import { createAutoJournalEntry, getSystemAccount } from "@/lib/accounting/journal";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isMobileShopModuleEnabled(session)) {
      return NextResponse.json({ error: "Mobile Shop module is not enabled" }, { status: 403 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;

    const device = await prisma.mobileDevice.findFirst({
      where: { id, organizationId },
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
    console.error("Failed to fetch mobile device:", error);
    return NextResponse.json(
      { error: "Failed to fetch mobile device" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isMobileShopModuleEnabled(session)) {
      return NextResponse.json({ error: "Mobile Shop module is not enabled" }, { status: 403 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.mobileDevice.findFirst({
      where: { id, organizationId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    // If imei1 changed, check uniqueness
    if (body.imei1 && body.imei1 !== existing.imei1) {
      if (!/^\d{15}$/.test(body.imei1)) {
        return NextResponse.json({ error: "IMEI 1 must be exactly 15 digits" }, { status: 400 });
      }
      const dup = await prisma.mobileDevice.findUnique({
        where: { organizationId_imei1: { organizationId, imei1: body.imei1 } },
      });
      if (dup) {
        return NextResponse.json({ error: "A device with this IMEI already exists" }, { status: 409 });
      }
    }

    if (body.imei2 && !/^\d{15}$/.test(body.imei2)) {
      return NextResponse.json({ error: "IMEI 2 must be exactly 15 digits" }, { status: 400 });
    }

    // Auto-mark SOLD when salesInvoiceId is newly set
    const updateData: Record<string, unknown> = {};
    const fields = [
      "imei1", "imei2", "serialNumber", "brand", "model", "color",
      "storageCapacity", "ram", "networkStatus", "conditionGrade",
      "batteryHealthPercentage", "includedAccessories", "productId",
      "supplierId", "costPrice", "landedCost", "sellingPrice",
      "currentStatus", "customerId", "salesInvoiceId", "soldPrice",
      "salespersonId", "notes", "photoUrls",
    ];
    for (const f of fields) {
      if (body[f] !== undefined) updateData[f] = body[f];
    }

    // Handle warranty dates
    if (body.supplierWarrantyExpiry !== undefined) {
      updateData.supplierWarrantyExpiry = body.supplierWarrantyExpiry ? new Date(body.supplierWarrantyExpiry) : null;
    }
    if (body.customerWarrantyExpiry !== undefined) {
      updateData.customerWarrantyExpiry = body.customerWarrantyExpiry ? new Date(body.customerWarrantyExpiry) : null;
    }

    // Auto-mark as SOLD when salesInvoiceId is newly set
    if (body.salesInvoiceId && !existing.salesInvoiceId) {
      updateData.currentStatus = "SOLD";
      updateData.outwardDate = new Date();
    }

    const device = await prisma.$transaction(async (tx) => {
      let finalProductId = existing.productId;

      if (body.createProduct && body.productName) {
        const newProduct = await tx.product.create({
          data: {
            organizationId,
            name: body.productName,
            price: body.sellingPrice || 0,
            cost: body.costPrice || 0,
            unitId: body.unitId || null,
            categoryId: body.categoryId || null,
            hsnCode: body.hsnCode || null,
            gstRate: parseFloat(body.gstRate) || 0,
            isImeiTracked: true,
          }
        });
        updateData.productId = newProduct.id;
        finalProductId = newProduct.id;
      }

      const updatedDevice = await tx.mobileDevice.update({
        where: { id },
        data: updateData,
        include: {
          supplier: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true } },
          product: { select: { id: true, name: true } },
        },
      });

      if (existing.openingStockId) {
        const openingStock = await tx.openingStock.findUnique({
          where: { id: existing.openingStockId },
          include: { stockLot: true },
        });

        if (openingStock) {
          const newCostPrice = body.costPrice !== undefined ? body.costPrice : Number(openingStock.unitCost);

          await tx.openingStock.update({
            where: { id: openingStock.id },
            data: { unitCost: newCostPrice }
          });

          if (openingStock.stockLot) {
            await tx.stockLot.update({
              where: { id: openingStock.stockLot.id },
              data: { unitCost: newCostPrice }
            });
          }

          await tx.journalEntry.deleteMany({
            where: { sourceType: "OPENING_BALANCE", sourceId: openingStock.id, organizationId }
          });

          if (newCostPrice > 0) {
            const inventoryAccount = await getSystemAccount(tx, organizationId, "1400");
            const ownerCapitalAccount = await getSystemAccount(tx, organizationId, "3100");
            if (inventoryAccount && ownerCapitalAccount) {
              await createAutoJournalEntry(tx, organizationId, {
                date: openingStock.stockDate,
                description: `Opening Stock - Updated (IMEI: ${existing.imei1})`,
                sourceType: "OPENING_BALANCE",
                sourceId: openingStock.id,
                lines: [
                  { accountId: inventoryAccount.id, description: "Inventory", debit: newCostPrice, credit: 0 },
                  { accountId: ownerCapitalAccount.id, description: "Opening Balance Equity", debit: 0, credit: newCostPrice },
                ]
              });
            }
          }

          if (newCostPrice !== Number(openingStock.unitCost)) {
            await tx.product.update({
              where: { id: openingStock.productId },
              data: { cost: newCostPrice }
            });

            await recalculateFromDate(openingStock.productId, openingStock.stockDate, tx, "mobile_device_cost_update", undefined, organizationId);
          }
        }
      }
      return updatedDevice;
    });

    return NextResponse.json(device);
  } catch (error) {
    console.error("Failed to update mobile device:", error);
    return NextResponse.json(
      { error: "Failed to update mobile device" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isMobileShopModuleEnabled(session)) {
      return NextResponse.json({ error: "Mobile Shop module is not enabled" }, { status: 403 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;

    const device = await prisma.mobileDevice.findFirst({
      where: { id, organizationId },
    });
    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    if (device.currentStatus !== "IN_STOCK") {
      return NextResponse.json(
        { error: "Can only delete devices that are IN_STOCK" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.mobileDevice.delete({ where: { id } });

      if (device.openingStockId) {
        const openingStock = await tx.openingStock.findUnique({
          where: { id: device.openingStockId },
          include: { stockLot: { include: { consumptions: true } } },
        });

        if (openingStock) {
          if (openingStock.stockLot) {
            await tx.stockLot.delete({ where: { id: openingStock.stockLot.id } });
          }
          await tx.openingStock.delete({ where: { id: device.openingStockId } });

          const hasConsumptions = (openingStock.stockLot?.consumptions?.length ?? 0) > 0;
          if (hasConsumptions) {
            await recalculateFromDate(openingStock.productId, openingStock.stockDate, tx, "mobile_device_delete", undefined, organizationId);
          }
          await tx.journalEntry.deleteMany({
            where: { sourceType: "OPENING_BALANCE", sourceId: device.openingStockId, organizationId },
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete mobile device:", error);
    return NextResponse.json(
      { error: "Failed to delete mobile device" },
      { status: 500 }
    );
  }
}
