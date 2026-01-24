import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    console.log(`[Fix Balances] Starting balance fix by ${session.user.email}`);

    const customers = await prisma.customer.findMany({
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
        // Get all transactions for this customer
        const transactions = await prisma.customerTransaction.findMany({
          where: { customerId: customer.id },
          orderBy: { transactionDate: "asc" },
        });

        // Calculate correct balance from transactions
        const calculatedBalance = transactions.reduce((sum, txn) => sum + Number(txn.amount), 0);

        const discrepancy = Number(customer.balance) - calculatedBalance;

        if (Math.abs(discrepancy) > 0.01) {
          console.log(
            `[Fix Balances] Fixing ${customer.name}: ${customer.balance} → ${calculatedBalance.toFixed(2)}`
          );

          await prisma.$transaction(async (tx) => {
            // Update customer balance
            await tx.customer.update({
              where: { id: customer.id },
              data: { balance: calculatedBalance },
            });

            // Recalculate and update running balances for all transactions
            let runningBalance = 0;
            for (const txn of transactions) {
              runningBalance += Number(txn.amount);
              await tx.customerTransaction.update({
                where: { id: txn.id },
                data: { runningBalance },
              });
            }
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

    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const customers = await prisma.customer.findMany({
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
      // Get all transactions for this customer
      const transactions = await prisma.customerTransaction.findMany({
        where: { customerId: customer.id },
      });

      // Calculate correct balance from transactions
      const calculatedBalance = transactions.reduce((sum, txn) => sum + Number(txn.amount), 0);

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
