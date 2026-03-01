import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isMobileShopModuleEnabled } from "@/lib/auth-utils";

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

    if (body.createProduct && body.productName) {
      const newProduct = await prisma.product.create({
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
    }

    const device = await prisma.mobileDevice.update({
      where: { id },
      data: updateData,
      include: {
        supplier: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
      },
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

    await prisma.mobileDevice.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete mobile device:", error);
    return NextResponse.json(
      { error: "Failed to delete mobile device" },
      { status: 500 }
    );
  }
}
