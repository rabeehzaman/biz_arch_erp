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

    const customers = await prisma.customer.findMany({
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
            invoices: true,
          },
        },
      },
      orderBy: {
        balance: "desc",
      },
    });

    const formattedCustomers = customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      balance: Number(customer.balance),
      invoiceCount: customer._count.invoices,
      isActive: customer.isActive,
    }));

    const ledgerBalance = formattedCustomers.reduce((sum, c) => sum + c.balance, 0);

    // GL reconciliation: compute AR balance from journal entries on account 1300
    const glARLines = await prisma.journalEntryLine.findMany({
      where: {
        organizationId,
        journalEntry: { status: "POSTED" },
        account: { code: "1300" },
      },
      select: { debit: true, credit: true },
    });
    const glBalance = glARLines.reduce(
      (sum, line) => sum + Number(line.debit) - Number(line.credit),
      0
    );

    const summary = {
      totalCustomers: customers.length,
      activeCustomers: customers.filter((c) => c.isActive).length,
      totalReceivable: formattedCustomers.reduce((sum, c) => sum + Math.max(0, c.balance), 0),
      totalAdvances: formattedCustomers.reduce((sum, c) => sum + Math.abs(Math.min(0, c.balance)), 0),
      netBalance: ledgerBalance,
      customersWithBalance: formattedCustomers.filter((c) => c.balance > 0).length,
      customersWithAdvances: formattedCustomers.filter((c) => c.balance < 0).length,
    };

    return NextResponse.json({
      customers: formattedCustomers,
      summary,
      reconciliation: {
        glBalance,
        ledgerBalance,
        difference: glBalance - ledgerBalance,
        isReconciled: Math.abs(glBalance - ledgerBalance) < 0.01,
      },
    });
  } catch (error) {
    console.error("Error fetching customer balances:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer balances" },
      { status: 500 }
    );
  }
}
