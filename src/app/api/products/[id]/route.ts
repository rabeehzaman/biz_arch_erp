import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id, organizationId },
      include: {
        unit: true,
        bundleItems: {
          include: {
            componentProduct: {
              select: { id: true, name: true, price: true, cost: true, unitId: true, unit: { select: { id: true, code: true, name: true } } },
            },
          },
        },
        unitConversions: {
          select: {
            id: true,
            unitId: true,
            unit: { select: { id: true, name: true, code: true } },
            conversionFactor: true,
            barcode: true,
            price: true,
            isDefaultUnit: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("Failed to fetch product:", error);
    return NextResponse.json(
      { error: "Failed to fetch product" },
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

    const organizationId = getOrgId(session);
    const { id } = await params;
    const body = await request.json();
    const { name, description, price, cost, unitId, categoryId, sku, barcode, isActive, isService, isImeiTracked, gstRate, hsnCode, weighMachineCode, isBundle, bundleItems, unitConversions } = body;

    // Check for duplicate product name (exclude current product)
    if (name) {
      const existingByName = await prisma.product.findFirst({
        where: { organizationId, name: { equals: name.trim(), mode: "insensitive" }, id: { not: id } },
        select: { id: true },
      });
      if (existingByName) {
        return NextResponse.json(
          { error: "A product with this name already exists." },
          { status: 400 }
        );
      }
    }

    const VALID_GST_RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 7.5, 12, 18, 28];
    if (gstRate !== undefined && gstRate !== null && !VALID_GST_RATES.includes(Number(gstRate))) {
      return NextResponse.json(
        { error: `Invalid GST rate: ${gstRate}. Valid rates are: ${VALID_GST_RATES.join(", ")}` },
        { status: 400 }
      );
    }

    const product = await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id, organizationId },
        data: {
          name,
          description,
          price,
          ...(cost !== undefined && { cost }),
          unitId,
          categoryId: categoryId !== undefined ? (categoryId || null) : undefined,
          sku,
          barcode,
          isActive,
          ...(isService !== undefined && { isService }),
          ...(isImeiTracked !== undefined && { isImeiTracked }),
          ...(isBundle !== undefined && { isBundle }),
          ...(weighMachineCode !== undefined && { weighMachineCode: weighMachineCode || null }),
          ...(hsnCode !== undefined && { hsnCode: hsnCode || null }),
          ...(gstRate !== undefined && { gstRate }),
        },
        include: {
          unit: true,
        },
      });

      // Update bundle items if isBundle is being set
      if (isBundle !== undefined && Array.isArray(bundleItems)) {
        // Delete existing bundle items
        await tx.productBundleItem.deleteMany({
          where: { bundleProductId: id },
        });

        // Create new bundle items
        if (isBundle && bundleItems.length > 0) {
          for (const bi of bundleItems) {
            if (bi.componentProductId && bi.quantity > 0) {
              await tx.productBundleItem.create({
                data: {
                  bundleProductId: id,
                  componentProductId: bi.componentProductId,
                  quantity: bi.quantity,
                  organizationId,
                },
              });
            }
          }
        }
      }

      // Update unit conversions if provided (delete-and-recreate)
      if (Array.isArray(unitConversions)) {
        await tx.productUnitConversion.deleteMany({
          where: { productId: id },
        });

        for (const uc of unitConversions) {
          if (uc.unitId && uc.conversionFactor > 0) {
            await tx.productUnitConversion.create({
              data: {
                productId: id,
                unitId: uc.unitId,
                conversionFactor: uc.conversionFactor,
                barcode: uc.barcode || null,
                price: uc.price != null ? uc.price : null,
                isDefaultUnit: uc.isDefaultUnit ?? false,
                organizationId,
              },
            });
          }
        }
      }

      // Re-fetch with all relations
      return tx.product.findUnique({
        where: { id },
        include: {
          unit: true,
          bundleItems: {
            include: {
              componentProduct: {
                select: { id: true, name: true, price: true, cost: true, unitId: true, unit: { select: { id: true, code: true, name: true } } },
              },
            },
          },
          unitConversions: {
            select: {
              id: true,
              unitId: true,
              unit: { select: { id: true, name: true, code: true } },
              conversionFactor: true,
              barcode: true,
              price: true,
            },
          },
        },
      });
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error("Failed to update product:", error);
    return NextResponse.json(
      { error: "Failed to update product" },
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

    const organizationId = getOrgId(session);
    const { id } = await params;

    await prisma.$transaction(async (tx) => {
      // Delete bundle items (parent and component references)
      await tx.productBundleItem.deleteMany({ where: { bundleProductId: id } });
      await tx.productBundleItem.deleteMany({ where: { componentProductId: id } });

      // Delete mobile devices linked to this product
      await tx.mobileDevice.deleteMany({ where: { productId: id, organizationId } });

      // Find opening stocks to clean up their journal entries
      const openingStocks = await tx.openingStock.findMany({
        where: { productId: id, organizationId },
        select: { id: true },
      });
      const openingStockIds = openingStocks.map((o) => o.id);

      // Delete journal entries that were created from these opening stocks
      if (openingStockIds.length > 0) {
        const journalEntries = await tx.journalEntry.findMany({
          where: { sourceType: "OPENING_BALANCE", sourceId: { in: openingStockIds }, organizationId },
          select: { id: true },
        });
        const journalIds = journalEntries.map((j) => j.id);
        if (journalIds.length > 0) {
          await tx.journalEntryLine.deleteMany({ where: { journalEntryId: { in: journalIds } } });
          await tx.journalEntry.deleteMany({ where: { id: { in: journalIds } } });
        }
      }

      // Delete stock lots and opening stocks
      await tx.stockLot.deleteMany({ where: { productId: id, organizationId } });
      await tx.openingStock.deleteMany({ where: { productId: id, organizationId } });

      await tx.product.delete({ where: { id, organizationId } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete product:", error);
    return NextResponse.json(
      { error: "Failed to delete product" },
      { status: 500 }
    );
  }
}
