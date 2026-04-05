import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isSaudiEInvoiceEnabled } from "@/lib/auth-utils";
import { generateAutoNumber } from "@/lib/accounting/auto-number";
import { getOrgGSTInfo, computeDocumentGST } from "@/lib/gst/document-gst";
import { SAUDI_VAT_RATE } from "@/lib/saudi-vat/constants";
import { getUserAllowedBranchIds, buildBranchWhereClause } from "@/lib/user-access";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const userId = session.user.id!;
    const role = (session.user as any).role || "user";

    const allowedBranchIds = await getUserAllowedBranchIds(prisma, organizationId, userId, role);
    if (allowedBranchIds !== null && allowedBranchIds.length === 0) {
      return NextResponse.json([]);
    }
    const branchFilter = buildBranchWhereClause(allowedBranchIds, { includeNullBranch: true });

    const expenses = await prisma.expense.findMany({
      where: { organizationId, ...branchFilter },
      orderBy: { createdAt: "desc" },
      include: {
        supplier: { select: { id: true, name: true } },
        cashBankAccount: { select: { id: true, name: true } },
        items: {
          include: {
            account: { select: { id: true, code: true, name: true } },
          },
        },
        _count: { select: { items: true } },
      },
    });

    return NextResponse.json(expenses);
  } catch (error) {
    console.error("Failed to fetch expenses:", error);
    return NextResponse.json(
      { error: "Failed to fetch expenses" },
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
    const { supplierId, expenseDate, description, items, notes } = body;

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "At least one expense item is required" },
        { status: 400 }
      );
    }

    const expenseNumber = await generateAutoNumber(
      prisma.expense as never,
      "expenseNumber",
      "EXP",
      organizationId
    );

    const subtotal = items.reduce(
      (sum: number, item: { amount: number }) => sum + item.amount,
      0
    );

    const saudiEnabled = isSaudiEInvoiceEnabled(session);

    // Compute tax for expense items
    let gstResult = { totalCgst: 0, totalSgst: 0, totalIgst: 0, totalTax: 0, placeOfSupply: null as string | null, isInterState: false, lineGST: [] as Array<{ hsnCode: string | null; gstRate: number; cgstRate: number; sgstRate: number; igstRate: number; cgstAmount: number; sgstAmount: number; igstAmount: number }> };
    let totalVat: number | null = null;

    if (saudiEnabled) {
      // Saudi VAT: compute VAT per line
      let vatTotal = 0;
      for (const item of items) {
        const rate = item.vatRate !== undefined ? Number(item.vatRate) : SAUDI_VAT_RATE;
        vatTotal += item.amount * rate / 100;
      }
      totalVat = Math.round(vatTotal * 100) / 100;
    } else {
      const orgGST = await getOrgGSTInfo(prisma, organizationId);
      let supplierGstin: string | null = null;
      let supplierStateCode: string | null = null;
      if (supplierId) {
        const supplier = await prisma.supplier.findUnique({
          where: { id: supplierId },
          select: { gstin: true, gstStateCode: true },
        });
        supplierGstin = supplier?.gstin ?? null;
        supplierStateCode = supplier?.gstStateCode ?? null;
      }
      const lineItemsForGST = items.map((item: { amount: number; gstRate?: number }) => ({
        taxableAmount: item.amount,
        gstRate: item.gstRate || 0,
        hsnCode: null,
      }));
      gstResult = computeDocumentGST(orgGST, lineItemsForGST, supplierGstin, supplierStateCode);
    }
    const totalTax = totalVat !== null ? totalVat : gstResult.totalTax;
    const total = subtotal + totalTax;

    const expense = await prisma.expense.create({
      data: {
        expenseNumber,
        supplierId: supplierId || null,
        expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
        description: description || null,
        subtotal,
        total,
        totalCgst: saudiEnabled ? 0 : gstResult.totalCgst,
        totalSgst: saudiEnabled ? 0 : gstResult.totalSgst,
        totalIgst: saudiEnabled ? 0 : gstResult.totalIgst,
        placeOfSupply: saudiEnabled ? null : gstResult.placeOfSupply,
        isInterState: saudiEnabled ? false : gstResult.isInterState,
        totalVat: saudiEnabled ? totalVat : null,
        notes: notes || null,
        organizationId,
        items: {
          create: items.map(
            (item: { accountId: string; description: string; amount: number; gstRate?: number }, idx: number) => ({
              accountId: item.accountId,
              description: item.description,
              amount: item.amount,
              gstRate: saudiEnabled ? 0 : (gstResult.lineGST[idx]?.gstRate || 0),
              cgstAmount: saudiEnabled ? 0 : (gstResult.lineGST[idx]?.cgstAmount || 0),
              sgstAmount: saudiEnabled ? 0 : (gstResult.lineGST[idx]?.sgstAmount || 0),
              igstAmount: saudiEnabled ? 0 : (gstResult.lineGST[idx]?.igstAmount || 0),
              organizationId,
            })
          ),
        },
      },
      include: {
        items: {
          include: {
            account: { select: { id: true, code: true, name: true } },
          },
        },
        supplier: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("Failed to create expense:", error);
    return NextResponse.json(
      { error: "Failed to create expense" },
      { status: 500 }
    );
  }
}
