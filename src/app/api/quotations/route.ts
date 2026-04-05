import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isTaxInclusivePrice as isTaxInclusivePriceSession, isSaudiEInvoiceEnabled } from "@/lib/auth-utils";
import { isAdminRole } from "@/lib/access-control";
import { extractTaxExclusiveAmount } from "@/lib/tax/tax-inclusive";
import { getOrgGSTInfo, computeDocumentGST } from "@/lib/gst/document-gst";
import { SAUDI_VAT_RATE } from "@/lib/saudi-vat/constants";
import { toMidnightUTC } from "@/lib/date-utils";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { getUserAllowedBranchIds, buildBranchWhereClause } from "@/lib/user-access";

// Generate quotation number: QUO-YYYYMMDD-XXX
async function generateQuotationNumber(organizationId: string) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `QUO-${dateStr}`;

  const lastQuotation = await prisma.quotation.findFirst({
    where: { quotationNumber: { startsWith: prefix }, organizationId },
    orderBy: { quotationNumber: "desc" },
  });

  let sequence = 1;
  if (lastQuotation) {
    const lastSequence = parseInt(lastQuotation.quotationNumber.split("-").pop() || "0");
    sequence = lastSequence + 1;
  }

  return `${prefix}-${sequence.toString().padStart(3, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { limit, offset, search } = parsePagination(request);
    const isAdmin = isAdminRole(session.user.role);
    const userId = session.user.id;

    const allowedBranchIds = await getUserAllowedBranchIds(prisma, organizationId, userId!, session.user.role);
    if (allowedBranchIds !== null && allowedBranchIds.length === 0) {
      return paginatedResponse([], 0, false);
    }
    const branchFilter = buildBranchWhereClause(allowedBranchIds, { includeNullBranch: true });

    const baseWhere = isAdmin
      ? { organizationId, ...branchFilter }
      : { organizationId, customer: { assignments: { some: { userId } } }, ...branchFilter };
    const where = search
      ? {
          ...baseWhere,
          OR: [
            { quotationNumber: { contains: search, mode: "insensitive" as const } },
            { customer: { name: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : baseWhere;

    const [quotations, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          customer: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { items: true },
          },
        },
      }),
      prisma.quotation.count({ where }),
    ]);

    return paginatedResponse(quotations, total, offset + quotations.length < total);
  } catch (error) {
    console.error("Failed to fetch quotations:", error);
    return NextResponse.json(
      { error: "Failed to fetch quotations" },
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
    const { customerId, issueDate, validUntil, items, notes, terms, isTaxInclusive } = body;

    if (!customerId || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Customer and items are required" },
        { status: 400 }
      );
    }

    const saudiEnabled = isSaudiEInvoiceEnabled(session);

    if (!saudiEnabled) {
      const VALID_GST_RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 7.5, 12, 18, 28];
      for (const item of items) {
        if (item.gstRate !== undefined && item.gstRate !== null && !VALID_GST_RATES.includes(Number(item.gstRate))) {
          return NextResponse.json(
            { error: `Invalid GST rate: ${item.gstRate}. Valid rates are: ${VALID_GST_RATES.join(", ")}` },
            { status: 400 }
          );
        }
      }
    }

    const quotationNumber = await generateQuotationNumber(organizationId);
    const quotationIssueDate = toMidnightUTC(issueDate);
    const quotationValidUntil = validUntil ? toMidnightUTC(validUntil) : toMidnightUTC(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { isTaxInclusivePrice: true },
    });
    const taxInclusive = isTaxInclusive ?? (isTaxInclusivePriceSession(session) || org?.isTaxInclusivePrice);

    // Build per-line gross amounts and taxable amounts (for tax-inclusive pricing)
    const lineAmounts = items.map((item: { quantity: number; unitPrice: number; discount?: number; gstRate?: number; vatRate?: number }) => {
      const grossAmount = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
      const taxRate = saudiEnabled ? (item.vatRate !== undefined ? Number(item.vatRate) : SAUDI_VAT_RATE) : (item.gstRate || 0);
      const taxableAmount = taxInclusive ? extractTaxExclusiveAmount(grossAmount, taxRate) : grossAmount;
      return { grossAmount, taxableAmount };
    });

    // Calculate subtotal (sum of tax-exclusive base amounts)
    const subtotal = lineAmounts.reduce((sum: number, la: { taxableAmount: number }) => sum + la.taxableAmount, 0);

    // Tax computation
    let gstResult = { totalCgst: 0, totalSgst: 0, totalIgst: 0, totalTax: 0, placeOfSupply: null as string | null, isInterState: false, lineGST: [] as Array<{ hsnCode: string | null; gstRate: number; cgstRate: number; sgstRate: number; igstRate: number; cgstAmount: number; sgstAmount: number; igstAmount: number }> };
    let totalVat: number | null = null;

    if (saudiEnabled) {
      // Saudi VAT: compute VAT on each line
      let vatTotal = 0;
      for (let idx = 0; idx < items.length; idx++) {
        const taxableAmount = lineAmounts[idx].taxableAmount;
        const rate = items[idx].vatRate !== undefined ? Number(items[idx].vatRate) : SAUDI_VAT_RATE;
        vatTotal += Math.round(taxableAmount * rate) / 100;
      }
      totalVat = Math.round(vatTotal * 100) / 100;
    } else {
      // GST path
      const [orgGST, customer] = await Promise.all([
        getOrgGSTInfo(prisma, organizationId),
        prisma.customer.findUnique({
          where: { id: customerId },
          select: { gstin: true, gstStateCode: true },
        }),
      ]);
      // NOTE: We do not multiply discount amount by conversionFactor here because unitPrice should conceptually be for the selected unit.
      const lineItemsForGST = items.map((item: { quantity: number; unitPrice: number; discount?: number; gstRate?: number; hsnCode?: string; conversionFactor?: number }, idx: number) => ({
        taxableAmount: lineAmounts[idx].taxableAmount,
        gstRate: item.gstRate || 0,
        hsnCode: item.hsnCode || null,
      }));
      gstResult = computeDocumentGST(orgGST, lineItemsForGST, customer?.gstin, customer?.gstStateCode);
    }

    const totalTax = totalVat !== null ? totalVat : gstResult.totalTax;
    const total = subtotal + totalTax;

    // Create the quotation
    const quotation = await prisma.quotation.create({
      data: {
        organizationId,
        quotationNumber,
        customerId,
        issueDate: quotationIssueDate,
        validUntil: quotationValidUntil,
        status: "SENT",
        subtotal,
        total,
        totalCgst: saudiEnabled ? 0 : gstResult.totalCgst,
        totalSgst: saudiEnabled ? 0 : gstResult.totalSgst,
        totalIgst: saudiEnabled ? 0 : gstResult.totalIgst,
        placeOfSupply: saudiEnabled ? null : gstResult.placeOfSupply,
        isInterState: saudiEnabled ? false : gstResult.isInterState,
        totalVat: saudiEnabled ? totalVat : null,
        notes: notes || null,
        terms: terms || null,
        isTaxInclusive: isTaxInclusive ?? null,
        items: {
          create: items.map((item: {
            productId?: string;
            description: string;
            quantity: number;
            unitPrice: number;
            discount?: number;
            gstRate?: number;
            hsnCode?: string;
            unitId?: string;
            conversionFactor?: number;
            jewellery?: {
              jewelleryItemId: string;
              goldRate: number;
              purity: string;
              metalType: string;
              grossWeight: number;
              stoneWeight: number;
              wastagePercent: number;
              makingChargeType: string;
              makingChargeValue: number;
              stoneValue: number;
              tagNumber: string;
              huidNumber: string;
            };
          }, idx: number) => {
            const jw = item.jewellery;
            const netWeight = jw ? Math.max(0, jw.grossWeight - (jw.stoneWeight || 0)) : undefined;
            const PURITY_MULT: Record<string, number> = { K24: 1, K22: 22/24, K21: 21/24, K18: 18/24, K14: 14/24, K9: 9/24 };
            const fineWeight = jw && netWeight ? netWeight * (PURITY_MULT[jw.purity] ?? 1) : undefined;

            return {
            organizationId,
            productId: item.productId || null,
            description: item.description,
            quantity: item.quantity,
            unitId: item.unitId || null,
            conversionFactor: item.conversionFactor || 1,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
            total: lineAmounts[idx].taxableAmount,
            hsnCode: saudiEnabled ? null : (gstResult.lineGST[idx]?.hsnCode || item.hsnCode || null),
            gstRate: saudiEnabled ? 0 : (gstResult.lineGST[idx]?.gstRate || 0),
            cgstRate: saudiEnabled ? 0 : (gstResult.lineGST[idx]?.cgstRate || 0),
            sgstRate: saudiEnabled ? 0 : (gstResult.lineGST[idx]?.sgstRate || 0),
            igstRate: saudiEnabled ? 0 : (gstResult.lineGST[idx]?.igstRate || 0),
            cgstAmount: saudiEnabled ? 0 : (gstResult.lineGST[idx]?.cgstAmount || 0),
            sgstAmount: saudiEnabled ? 0 : (gstResult.lineGST[idx]?.sgstAmount || 0),
            igstAmount: saudiEnabled ? 0 : (gstResult.lineGST[idx]?.igstAmount || 0),
            // Jewellery fields
            jewelleryItemId: jw?.jewelleryItemId ?? null,
            goldRate: jw?.goldRate ?? null,
            purity: jw?.purity ?? null,
            metalType: jw?.metalType ?? null,
            grossWeight: jw?.grossWeight ?? null,
            netWeight: netWeight ?? null,
            fineWeight: fineWeight ?? null,
            wastagePercent: jw?.wastagePercent ?? null,
            makingChargeType: jw?.makingChargeType ?? null,
            makingChargeValue: jw?.makingChargeValue ?? null,
            stoneValue: jw?.stoneValue ?? null,
            tagNumber: jw?.tagNumber ?? null,
            huidNumber: jw?.huidNumber ?? null,
            };
          }),
        },
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return NextResponse.json(quotation, { status: 201 });
  } catch (error) {
    console.error("Failed to create quotation:", error);
    return NextResponse.json(
      { error: "Failed to create quotation" },
      { status: 500 }
    );
  }
}
