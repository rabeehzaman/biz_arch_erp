import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const organizationId = getOrgId(session);

    const suppliers = await prisma.supplier.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        balance: true,
        isActive: true,
        _count: {
          select: {
            purchaseInvoices: true,
          },
        },
      },
      orderBy: {
        balance: "desc",
      },
    });

    const formattedSuppliers = suppliers.map((supplier) => ({
      id: supplier.id,
      name: supplier.name,
      email: supplier.email,
      phone: supplier.phone,
      balance: Number(supplier.balance),
      invoiceCount: supplier._count.purchaseInvoices,
      isActive: supplier.isActive,
    }));

    const ledgerBalance = formattedSuppliers.reduce((sum, s) => sum + s.balance, 0);

    // GL reconciliation: compute AP balance from journal entries on account 2100
    const glAPLines = await prisma.journalEntryLine.findMany({
      where: {
        organizationId,
        journalEntry: { status: "POSTED" },
        account: { code: "2100" },
      },
      select: { debit: true, credit: true },
    });
    // AP is a liability: natural credit balance = credit - debit
    const glBalance = glAPLines.reduce(
      (sum, line) => sum + Number(line.credit) - Number(line.debit),
      0
    );

    const summary = {
      totalSuppliers: suppliers.length,
      activeSuppliers: suppliers.filter((s) => s.isActive).length,
      totalPayable: ledgerBalance,
      suppliersWithBalance: formattedSuppliers.filter((s) => s.balance > 0).length,
    };

    return NextResponse.json({
      suppliers: formattedSuppliers,
      summary,
      reconciliation: {
        glBalance,
        ledgerBalance,
        difference: glBalance - ledgerBalance,
        isReconciled: Math.abs(glBalance - ledgerBalance) < 0.01,
      },
    });
  } catch (error) {
    console.error("Error fetching supplier balances:", error);
    return NextResponse.json(
      { error: "Failed to fetch supplier balances" },
      { status: 500 }
    );
  }
}
