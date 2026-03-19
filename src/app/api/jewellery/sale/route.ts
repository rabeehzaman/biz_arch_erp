import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, getEdition, isJewelleryModuleEnabled } from "@/lib/auth-utils";
import { calculatePricing, type PricingBreakdown } from "@/lib/jewellery/pricing-engine";
import { calculateJewelleryTax, type JewelleryTaxBreakdown } from "@/lib/jewellery/tax-calculator";
import { getJewelleryConfig } from "@/lib/jewellery/config";

// Generate jewellery sale invoice number: JINV-YYYYMMDD-XXX
async function generateJewelleryInvoiceNumber(organizationId: string): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `JINV-${dateStr}`;

  const lastInvoice = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix }, organizationId },
    orderBy: { invoiceNumber: "desc" },
  });

  let sequence = 1;
  if (lastInvoice) {
    const lastSequence = parseInt(lastInvoice.invoiceNumber.split("-").pop() || "0");
    sequence = lastSequence + 1;
  }

  return `${prefix}-${sequence.toString().padStart(3, "0")}`;
}

interface ItemPricingResult {
  itemId: string;
  tagNumber: string;
  huidNumber: string | null;
  productId: string | null;
  grossWeight: number;
  netWeight: number;
  purity: string;
  metalType: string;
  goldRate: number;
  pricing: PricingBreakdown;
  tax: JewelleryTaxBreakdown;
  makingChargeType: string;
  makingChargeValue: number;
  wastagePercent: number;
  description: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isJewelleryModuleEnabled(session)) return NextResponse.json({ error: "Jewellery module is not enabled" }, { status: 403 });
    const organizationId = getOrgId(session);
    const edition = getEdition(session);

    const body = await request.json();
    const {
      customerId,
      itemIds,
      lockedGoldRateId,
      paymentType = "CASH",
      oldGoldAdjustmentId,
      notes,
    } = body;

    if (!customerId) {
      return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json({ error: "itemIds must be a non-empty array" }, { status: 400 });
    }

    // Load jewellery config for tax calculation
    const config = await getJewelleryConfig(organizationId);

    // Verify customer exists
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, organizationId },
      select: { id: true, name: true, gstStateCode: true },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Determine if inter-state (India)
    let isInterState = false;
    if (edition === "INDIA") {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { gstStateCode: true },
      });
      if (org?.gstStateCode && customer.gstStateCode && org.gstStateCode !== customer.gstStateCode) {
        isInterState = true;
      }
    }

    // Fetch all items and verify they belong to this org and are IN_STOCK
    const items = await prisma.jewelleryItem.findMany({
      where: {
        id: { in: itemIds },
        organizationId,
      },
      include: { category: true },
    });

    if (items.length !== itemIds.length) {
      const foundIds = new Set(items.map((i) => i.id));
      const missing = itemIds.filter((id: string) => !foundIds.has(id));
      return NextResponse.json(
        { error: "Some items not found", missingIds: missing },
        { status: 404 }
      );
    }

    const nonStockItems = items.filter((i) => i.status !== "IN_STOCK");
    if (nonStockItems.length > 0) {
      return NextResponse.json(
        {
          error: "Some items are not available for sale",
          unavailable: nonStockItems.map((i) => ({
            id: i.id,
            tagNumber: i.tagNumber,
            status: i.status,
          })),
        },
        { status: 400 }
      );
    }

    // Get gold rates: use locked rate or fetch today's rates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Collect distinct purity+metalType combos needed
    const rateCombos = [...new Set(items.map((i) => `${i.purity}|${i.metalType}`))];

    const rateMap = new Map<string, number>();

    if (lockedGoldRateId) {
      // Use a specific locked rate record
      const lockedRate = await prisma.goldRate.findFirst({
        where: { id: lockedGoldRateId, organizationId, rateLocked: true },
      });
      if (!lockedRate) {
        return NextResponse.json({ error: "Locked gold rate not found" }, { status: 404 });
      }
      // The locked rate applies to its purity; for other purities, fall back to today's rate
      rateMap.set(`${lockedRate.purity}|${lockedRate.metalType}`, Number(lockedRate.sellRate));
    }

    // Fetch today's rates for any combos not covered by locked rate
    for (const combo of rateCombos) {
      if (!rateMap.has(combo)) {
        const [purStr, mtStr] = combo.split("|");
        const rate = await prisma.goldRate.findFirst({
          where: {
            organizationId,
            purity: purStr as any,
            metalType: mtStr as any,
            date: { gte: today, lt: tomorrow },
          },
          orderBy: { date: "desc" },
        });
        if (!rate) {
          return NextResponse.json(
            { error: `No gold rate set for today for ${purStr} ${mtStr}. Please set a rate first.` },
            { status: 400 }
          );
        }
        rateMap.set(combo, Number(rate.sellRate));
      }
    }

    // Calculate pricing and tax for each item
    const itemPricings: ItemPricingResult[] = items.map((item) => {
      const goldRate = rateMap.get(`${item.purity}|${item.metalType}`) || 0;
      const netWeight = Number(item.netWeight);

      const pricing = calculatePricing({
        netWeight,
        purity: item.purity,
        goldRate,
        wastagePercent: Number(item.wastagePercent),
        makingChargeType: item.makingChargeType as "PER_GRAM" | "PERCENTAGE" | "FIXED",
        makingChargeValue: Number(item.makingChargeValue),
        stoneValue: Number(item.stoneValue),
      });

      const tax = calculateJewelleryTax(pricing, config, {
        purity: item.purity,
        isInterState,
      });

      const categoryName = item.category?.name || "Jewellery";

      return {
        itemId: item.id,
        tagNumber: item.tagNumber,
        huidNumber: item.huidNumber,
        productId: item.productId,
        grossWeight: Number(item.grossWeight),
        netWeight,
        purity: item.purity,
        metalType: item.metalType,
        goldRate,
        pricing,
        tax,
        makingChargeType: item.makingChargeType,
        makingChargeValue: Number(item.makingChargeValue),
        wastagePercent: Number(item.wastagePercent),
        description: `${categoryName} - Tag #${item.tagNumber}${item.huidNumber ? ` (HUID: ${item.huidNumber})` : ""}`,
      };
    });

    // Aggregate totals
    const invoiceSubtotal = round2(itemPricings.reduce((sum, p) => sum + p.pricing.subtotal, 0));
    const totalTax = round2(itemPricings.reduce((sum, p) => sum + p.tax.totalTax, 0));
    const totalCgst = round2(itemPricings.reduce((sum, p) => sum + p.tax.cgstAmount, 0));
    const totalSgst = round2(itemPricings.reduce((sum, p) => sum + p.tax.sgstAmount, 0));
    const totalIgst = round2(itemPricings.reduce((sum, p) => sum + p.tax.igstAmount, 0));
    const totalVat = round2(itemPricings.reduce((sum, p) => sum + p.tax.vatAmount, 0));

    let grandTotal = round2(invoiceSubtotal + totalTax);

    // Deduct old gold adjustment if provided
    let oldGoldDeduction = 0;
    if (oldGoldAdjustmentId) {
      const oldGold = await prisma.oldGoldPurchase.findFirst({
        where: { id: oldGoldAdjustmentId, organizationId },
      });
      if (oldGold) {
        oldGoldDeduction = Number(oldGold.totalValue);
        grandTotal = round2(grandTotal - oldGoldDeduction);
        if (grandTotal < 0) grandTotal = 0;
      }
    }

    // Create invoice + items + mark as SOLD in a single transaction
    const invoice = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await generateJewelleryInvoiceNumber(organizationId);
      const now = new Date();

      const inv = await tx.invoice.create({
        data: {
          invoiceNumber,
          organizationId,
          customerId,
          createdById: session.user.id,
          issueDate: now,
          dueDate: paymentType === "CREDIT" ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) : now,
          subtotal: invoiceSubtotal,
          total: grandTotal,
          amountPaid: paymentType === "CASH" ? grandTotal : 0,
          balanceDue: paymentType === "CASH" ? 0 : grandTotal,
          totalCgst,
          totalSgst,
          totalIgst,
          totalVat: edition === "SAUDI" ? totalVat : null,
          isInterState,
          paymentType,
          sourceType: "MANUAL",
          notes: notes
            ? `${notes}\n\n[Jewellery Sale]${oldGoldDeduction > 0 ? ` Old Gold Adjustment: -${oldGoldDeduction}` : ""}`
            : `[Jewellery Sale]${oldGoldDeduction > 0 ? ` Old Gold Adjustment: -${oldGoldDeduction}` : ""}`,
          items: {
            create: itemPricings.map((p) => ({
              organizationId,
              productId: p.productId,
              description: p.description,
              quantity: 1,
              unitPrice: p.pricing.subtotal,
              discount: 0,
              total: p.tax.grandTotal,
              hsnCode: "7113",
              gstRate: edition === "INDIA" ? p.tax.goldTaxRate : 0,
              cgstRate: edition === "INDIA" ? (isInterState ? 0 : round2(p.tax.goldTaxRate / 2)) : 0,
              sgstRate: edition === "INDIA" ? (isInterState ? 0 : round2(p.tax.goldTaxRate / 2)) : 0,
              igstRate: edition === "INDIA" && isInterState ? p.tax.goldTaxRate : 0,
              cgstAmount: p.tax.cgstAmount,
              sgstAmount: p.tax.sgstAmount,
              igstAmount: p.tax.igstAmount,
              vatRate: edition === "SAUDI" ? p.tax.vatRate : null,
              vatAmount: edition === "SAUDI" ? p.tax.vatAmount : null,
              vatCategory: edition === "SAUDI" ? (p.purity === "K24" ? "Z" : "S") : null,
              costOfGoodsSold: Number(
                items.find((i) => i.id === p.itemId)?.costPrice ?? 0
              ),
            })),
          },
        },
        include: {
          items: true,
          customer: { select: { id: true, name: true, email: true } },
        },
      });

      // Mark all items as SOLD
      await tx.jewelleryItem.updateMany({
        where: { id: { in: itemIds }, organizationId },
        data: { status: "SOLD" },
      });

      // Link old gold adjustment to this invoice
      if (oldGoldAdjustmentId) {
        await tx.oldGoldPurchase.update({
          where: { id: oldGoldAdjustmentId },
          data: { adjustedAgainstInvoiceId: inv.id },
        });
      }

      return inv;
    });

    return NextResponse.json({
      invoice,
      breakdown: {
        items: itemPricings.map((p) => ({
          tagNumber: p.tagNumber,
          huidNumber: p.huidNumber,
          purity: p.purity,
          goldRate: p.goldRate,
          grossWeight: p.grossWeight,
          netWeight: p.netWeight,
          pricing: p.pricing,
          tax: p.tax,
        })),
        subtotal: invoiceSubtotal,
        totalTax,
        oldGoldDeduction,
        grandTotal,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to process jewellery sale:", error);
    return NextResponse.json({ error: "Failed to process jewellery sale" }, { status: 500 });
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
