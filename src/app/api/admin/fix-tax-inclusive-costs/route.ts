import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

// GET: Check which products and devices have tax-inclusive costs that need fixing
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const organizationId = getOrgId(session);

    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    // Only relevant for tax-inclusive orgs
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { isTaxInclusivePrice: true },
    });

    if (!org?.isTaxInclusivePrice) {
      return NextResponse.json({
        message: "This organization does not use tax-inclusive pricing. No fix needed.",
        productIssues: [],
        deviceIssues: [],
      });
    }

    // --- Product.cost issues ---
    // Find products where cost differs from the latest stock lot's unitCost
    const products = await prisma.product.findMany({
      where: {
        organizationId,
        stockLots: { some: {} },
      },
      select: {
        id: true,
        name: true,
        cost: true,
        stockLots: {
          orderBy: { lotDate: "desc" },
          take: 1,
          select: { unitCost: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const productIssues = products
      .filter((p) => {
        if (p.stockLots.length === 0) return false;
        const lotCost = Number(p.stockLots[0].unitCost);
        const productCost = Number(p.cost);
        return productCost > 0 && lotCost > 0 && Math.abs(productCost - lotCost) > 0.01;
      })
      .map((p) => ({
        id: p.id,
        name: p.name,
        currentCost: Number(p.cost),
        correctCost: Number(p.stockLots[0].unitCost),
      }));

    // --- MobileDevice.costPrice issues ---
    const devices = await prisma.mobileDevice.findMany({
      where: {
        organizationId,
        purchaseInvoiceId: { not: null },
      },
      select: {
        id: true,
        imei1: true,
        brand: true,
        model: true,
        costPrice: true,
        productId: true,
        purchaseInvoiceId: true,
      },
    });

    const deviceIssues: Array<{
      id: string;
      imei1: string;
      device: string;
      currentCost: number;
      correctCost: number;
    }> = [];

    for (const device of devices) {
      if (!device.productId || !device.purchaseInvoiceId) continue;

      const invoiceItem = await prisma.purchaseInvoiceItem.findFirst({
        where: {
          purchaseInvoiceId: device.purchaseInvoiceId,
          productId: device.productId,
        },
        select: { total: true, quantity: true },
      });

      if (!invoiceItem) continue;

      const qty = Number(invoiceItem.quantity);
      const correctCost = qty > 0 ? Number(invoiceItem.total) / qty : 0;
      const currentCost = Number(device.costPrice);

      if (correctCost > 0 && Math.abs(currentCost - correctCost) > 0.01) {
        deviceIssues.push({
          id: device.id,
          imei1: device.imei1,
          device: `${device.brand} ${device.model}`,
          currentCost,
          correctCost,
        });
      }
    }

    return NextResponse.json({
      message: productIssues.length > 0 || deviceIssues.length > 0
        ? `Found ${productIssues.length} product(s) and ${deviceIssues.length} device(s) with tax-inclusive costs.`
        : "All costs are already correct.",
      productIssues,
      deviceIssues,
    });
  } catch (error) {
    console.error("[Fix Tax-Inclusive Costs] Check error:", error);
    return NextResponse.json({ error: "Failed to check costs" }, { status: 500 });
  }
}

// POST: Fix product costs and device costs to tax-exclusive values
export async function POST(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const organizationId = getOrgId(session);

    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { isTaxInclusivePrice: true },
    });

    if (!org?.isTaxInclusivePrice) {
      return NextResponse.json({
        success: true,
        message: "This organization does not use tax-inclusive pricing. No fix needed.",
      });
    }

    console.log(`[Fix Tax-Inclusive Costs] Starting fix by ${session.user.email}`);

    // --- Fix Product.cost from latest StockLot ---
    const products = await prisma.product.findMany({
      where: {
        organizationId,
        stockLots: { some: {} },
      },
      select: {
        id: true,
        name: true,
        cost: true,
        stockLots: {
          orderBy: { lotDate: "desc" },
          take: 1,
          select: { unitCost: true },
        },
      },
    });

    const productFixes: Array<{ id: string; name: string; oldCost: number; newCost: number }> = [];

    for (const product of products) {
      if (product.stockLots.length === 0) continue;
      const lotCost = Number(product.stockLots[0].unitCost);
      const currentCost = Number(product.cost);

      if (currentCost > 0 && lotCost > 0 && Math.abs(currentCost - lotCost) > 0.01) {
        await prisma.product.update({
          where: { id: product.id },
          data: { cost: lotCost },
        });

        productFixes.push({
          id: product.id,
          name: product.name,
          oldCost: currentCost,
          newCost: lotCost,
        });

        console.log(`[Fix Tax-Inclusive Costs] Product ${product.name}: ${currentCost} -> ${lotCost}`);
      }
    }

    // --- Fix MobileDevice.costPrice ---
    const devices = await prisma.mobileDevice.findMany({
      where: {
        organizationId,
        purchaseInvoiceId: { not: null },
      },
      select: {
        id: true,
        imei1: true,
        brand: true,
        model: true,
        costPrice: true,
        productId: true,
        purchaseInvoiceId: true,
      },
    });

    const deviceFixes: Array<{ id: string; imei1: string; device: string; oldCost: number; newCost: number }> = [];

    for (const device of devices) {
      if (!device.productId || !device.purchaseInvoiceId) continue;

      const invoiceItem = await prisma.purchaseInvoiceItem.findFirst({
        where: {
          purchaseInvoiceId: device.purchaseInvoiceId,
          productId: device.productId,
        },
        select: { total: true, quantity: true },
      });

      if (!invoiceItem) continue;

      const qty = Number(invoiceItem.quantity);
      const correctCost = qty > 0 ? Number(invoiceItem.total) / qty : 0;
      const currentCost = Number(device.costPrice);

      if (correctCost > 0 && Math.abs(currentCost - correctCost) > 0.01) {
        await prisma.mobileDevice.update({
          where: { id: device.id },
          data: { costPrice: correctCost },
        });

        deviceFixes.push({
          id: device.id,
          imei1: device.imei1,
          device: `${device.brand} ${device.model}`,
          oldCost: currentCost,
          newCost: correctCost,
        });

        console.log(`[Fix Tax-Inclusive Costs] Device ${device.imei1}: ${currentCost} -> ${correctCost}`);
      }
    }

    console.log(`[Fix Tax-Inclusive Costs] Done. Fixed ${productFixes.length} products, ${deviceFixes.length} devices.`);

    return NextResponse.json({
      success: true,
      summary: {
        productsFixed: productFixes.length,
        devicesFixed: deviceFixes.length,
      },
      productFixes,
      deviceFixes,
      message: productFixes.length > 0 || deviceFixes.length > 0
        ? `Fixed ${productFixes.length} product(s) and ${deviceFixes.length} device(s).`
        : "No records needed fixing.",
    });
  } catch (error) {
    console.error("[Fix Tax-Inclusive Costs] Fix error:", error);
    return NextResponse.json({ error: "Failed to fix costs" }, { status: 500 });
  }
}
