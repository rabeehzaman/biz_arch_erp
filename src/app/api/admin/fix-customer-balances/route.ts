import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const organizationId = getOrgId(session);

    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    console.log(`[Fix Balances] Starting balance fix by ${session.user.email}`);

    const customers = await prisma.customer.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        balance: true,
      },
      orderBy: { name: "asc" },
    });

    console.log(`[Fix Balances] Found ${customers.length} customers to check`);

    const fixes: Array<{
      id: string;
      name: string;
      oldBalance: number;
      newBalance: number;
      difference: number;
    }> = [];

    let fixedCount = 0;
    let errorCount = 0;

    for (const customer of customers) {
      try {
        // Calculate balance from actual transactions (not CustomerTransaction table)
        // because invoices don't create CustomerTransaction records
        const [invoices, payments, creditNotes, openingBalance] = await Promise.all([
          prisma.invoice.aggregate({
            where: { customerId: customer.id, organizationId },
            _sum: { total: true },
          }),
          prisma.payment.aggregate({
            where: { customerId: customer.id, organizationId },
            _sum: { amount: true },
          }),
          prisma.creditNote.aggregate({
            where: { customerId: customer.id, organizationId, appliedToBalance: true },
            _sum: { total: true },
          }),
          prisma.customerTransaction.findFirst({
            where: { customerId: customer.id, organizationId, transactionType: "OPENING_BALANCE" },
            select: { amount: true },
          }),
        ]);

        const invoiceTotal = Number(invoices._sum.total || 0);
        const paymentTotal = Number(payments._sum.amount || 0);
        const creditNoteTotal = Number(creditNotes._sum.total || 0);
        const openingBalanceAmount = Number(openingBalance?.amount || 0);

        // Correct formula: opening + invoices - payments - creditNotes
        const calculatedBalance = openingBalanceAmount + invoiceTotal - paymentTotal - creditNoteTotal;

        const discrepancy = Number(customer.balance) - calculatedBalance;

        if (Math.abs(discrepancy) > 0.01) {
          console.log(
            `[Fix Balances] Fixing ${customer.name}: ${customer.balance} → ${calculatedBalance.toFixed(2)}`
          );

          // Update customer balance
          await prisma.customer.update({
            where: { id: customer.id },
            data: { balance: calculatedBalance },
          });

          fixes.push({
            id: customer.id,
            name: customer.name,
            oldBalance: Number(customer.balance),
            newBalance: calculatedBalance,
            difference: discrepancy,
          });

          fixedCount++;
        }
      } catch (error) {
        console.error(`[Fix Balances] Error fixing ${customer.name}:`, error);
        errorCount++;
      }
    }

    console.log(`[Fix Balances] Completed: ${fixedCount} fixed, ${errorCount} errors`);

    return NextResponse.json({
      success: true,
      summary: {
        totalCustomers: customers.length,
        fixedCount,
        errorCount,
      },
      fixes,
      message: `Successfully fixed ${fixedCount} customer balances`,
    });
  } catch (error) {
    console.error("[Fix Balances] Fatal error:", error);
    return NextResponse.json(
      { error: "Failed to fix customer balances", details: String(error) },
      { status: 500 }
    );
  }
}

// GET method to check what would be fixed (dry run)
export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const organizationId = getOrgId(session);

    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const customers = await prisma.customer.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        balance: true,
      },
      orderBy: { name: "asc" },
    });

    const issues: Array<{
      id: string;
      name: string;
      storedBalance: number;
      calculatedBalance: number;
      difference: number;
    }> = [];

    for (const customer of customers) {
      // Calculate balance from actual transactions (not CustomerTransaction table)
      // because invoices don't create CustomerTransaction records
      const [invoices, payments, creditNotes, openingBalance] = await Promise.all([
        prisma.invoice.aggregate({
          where: { customerId: customer.id, organizationId },
          _sum: { total: true },
        }),
        prisma.payment.aggregate({
          where: { customerId: customer.id, organizationId },
          _sum: { amount: true },
        }),
        prisma.creditNote.aggregate({
          where: { customerId: customer.id, organizationId, appliedToBalance: true },
          _sum: { total: true },
        }),
        prisma.customerTransaction.findFirst({
          where: { customerId: customer.id, organizationId, transactionType: "OPENING_BALANCE" },
          select: { amount: true },
        }),
      ]);

      const invoiceTotal = Number(invoices._sum.total || 0);
      const paymentTotal = Number(payments._sum.amount || 0);
      const creditNoteTotal = Number(creditNotes._sum.total || 0);
      const openingBalanceAmount = Number(openingBalance?.amount || 0);

      // Correct formula: opening + invoices - payments - creditNotes
      const calculatedBalance = openingBalanceAmount + invoiceTotal - paymentTotal - creditNoteTotal;

      const discrepancy = Number(customer.balance) - calculatedBalance;

      if (Math.abs(discrepancy) > 0.01) {
        issues.push({
          id: customer.id,
          name: customer.name,
          storedBalance: Number(customer.balance),
          calculatedBalance,
          difference: discrepancy,
        });
      }
    }

    return NextResponse.json({
      totalCustomers: customers.length,
      customersWithIssues: issues.length,
      issues,
      message:
        issues.length > 0
          ? `Found ${issues.length} customers with balance discrepancies. Use POST to fix them.`
          : "All customer balances are correct!",
    });
  } catch (error) {
    console.error("[Fix Balances] Error checking balances:", error);
    return NextResponse.json(
      { error: "Failed to check customer balances", details: String(error) },
      { status: 500 }
    );
  }
}
