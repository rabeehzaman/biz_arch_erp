import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { getOrgGSTInfo, computeDocumentGST } from "@/lib/gst/document-gst";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;

    const expense = await prisma.expense.findFirst({
      where: { id, organizationId },
      include: {
        supplier: { select: { id: true, name: true } },
        cashBankAccount: { select: { id: true, name: true } },
        journalEntry: {
          include: {
            lines: {
              include: { account: { select: { id: true, code: true, name: true } } },
            },
          },
        },
        items: {
          include: {
            account: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    return NextResponse.json(expense);
  } catch (error) {
    console.error("Failed to fetch expense:", error);
    return NextResponse.json(
      { error: "Failed to fetch expense" },
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

    const existing = await prisma.expense.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft expenses can be edited" },
        { status: 400 }
      );
    }

    const { supplierId, expenseDate, description, items, notes } = body;

    const subtotal = items
      ? items.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0)
      : Number(existing.subtotal);

    // Compute GST
    const orgGST = await getOrgGSTInfo(prisma, organizationId);
    let supplierGstin: string | null = null;
    let supplierStateCode: string | null = null;
    const sid = supplierId !== undefined ? supplierId : existing.supplierId;
    if (sid) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: sid },
        select: { gstin: true, gstStateCode: true },
      });
      supplierGstin = supplier?.gstin ?? null;
      supplierStateCode = supplier?.gstStateCode ?? null;
    }
    const lineItemsForGST = items
      ? items.map((item: { amount: number; gstRate?: number }) => ({
          taxableAmount: item.amount,
          gstRate: item.gstRate || 0,
          hsnCode: null,
        }))
      : [{ taxableAmount: subtotal, gstRate: 0, hsnCode: null }];
    const gstResult = computeDocumentGST(orgGST, lineItemsForGST, supplierGstin, supplierStateCode);
    const total = subtotal + gstResult.totalTax;

    const expense = await prisma.$transaction(async (tx) => {
      if (items) {
        await tx.expenseItem.deleteMany({ where: { expenseId: id } });
      }

      return tx.expense.update({
        where: { id, organizationId },
        data: {
          ...(supplierId !== undefined && { supplierId: supplierId || null }),
          ...(expenseDate && { expenseDate: new Date(expenseDate) }),
          ...(description !== undefined && { description }),
          ...(notes !== undefined && { notes }),
          subtotal,
          total,
          totalCgst: gstResult.totalCgst,
          totalSgst: gstResult.totalSgst,
          totalIgst: gstResult.totalIgst,
          placeOfSupply: gstResult.placeOfSupply,
          isInterState: gstResult.isInterState,
          ...(items && {
            items: {
              create: items.map(
                (item: { accountId: string; description: string; amount: number; gstRate?: number }, idx: number) => ({
                  accountId: item.accountId,
                  description: item.description,
                  amount: item.amount,
                  gstRate: gstResult.lineGST[idx]?.gstRate || 0,
                  cgstAmount: gstResult.lineGST[idx]?.cgstAmount || 0,
                  sgstAmount: gstResult.lineGST[idx]?.sgstAmount || 0,
                  igstAmount: gstResult.lineGST[idx]?.igstAmount || 0,
                  organizationId,
                })
              ),
            },
          }),
        },
        include: {
          items: {
            include: { account: { select: { id: true, code: true, name: true } } },
          },
        },
      });
    });

    return NextResponse.json(expense);
  } catch (error) {
    console.error("Failed to update expense:", error);
    return NextResponse.json(
      { error: "Failed to update expense" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;

    const existing = await prisma.expense.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft expenses can be deleted" },
        { status: 400 }
      );
    }

    await prisma.expense.delete({ where: { id, organizationId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete expense:", error);
    return NextResponse.json(
      { error: "Failed to delete expense" },
      { status: 500 }
    );
  }
}
