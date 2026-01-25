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

    console.log(`[Fix Supplier Balances] Starting balance fix by ${session.user.email}`);

    const suppliers = await prisma.supplier.findMany({
      select: {
        id: true,
        name: true,
        balance: true,
      },
      orderBy: { name: "asc" },
    });

    console.log(`[Fix Supplier Balances] Found ${suppliers.length} suppliers to check`);

    const fixes: Array<{
      id: string;
      name: string;
      oldBalance: number;
      newBalance: number;
      difference: number;
    }> = [];

    let fixedCount = 0;
    let errorCount = 0;

    for (const supplier of suppliers) {
      try {
        // Calculate balance from actual transactions (not SupplierTransaction table)
        // because purchase invoices don't create SupplierTransaction records
        const [purchaseInvoices, payments, debitNotes, openingBalance] = await Promise.all([
          prisma.purchaseInvoice.aggregate({
            where: { supplierId: supplier.id },
            _sum: { total: true },
          }),
          prisma.supplierPayment.aggregate({
            where: { supplierId: supplier.id },
            _sum: { amount: true },
          }),
          prisma.debitNote.aggregate({
            where: { supplierId: supplier.id, appliedToBalance: true },
            _sum: { total: true },
          }),
          prisma.supplierTransaction.findFirst({
            where: { supplierId: supplier.id, transactionType: "OPENING_BALANCE" },
            select: { amount: true },
          }),
        ]);

        const purchaseTotal = Number(purchaseInvoices._sum.total || 0);
        const paymentTotal = Number(payments._sum.amount || 0);
        const debitNoteTotal = Number(debitNotes._sum.total || 0);
        const openingBalanceAmount = Number(openingBalance?.amount || 0);

        // Correct formula: opening + purchases - payments - debitNotes
        // Positive = we owe them (Accounts Payable)
        const calculatedBalance = openingBalanceAmount + purchaseTotal - paymentTotal - debitNoteTotal;

        const discrepancy = Number(supplier.balance) - calculatedBalance;

        if (Math.abs(discrepancy) > 0.01) {
          console.log(
            `[Fix Supplier Balances] Fixing ${supplier.name}: ${supplier.balance} → ${calculatedBalance.toFixed(2)}`
          );

          // Update supplier balance
          await prisma.supplier.update({
            where: { id: supplier.id },
            data: { balance: calculatedBalance },
          });

          fixes.push({
            id: supplier.id,
            name: supplier.name,
            oldBalance: Number(supplier.balance),
            newBalance: calculatedBalance,
            difference: discrepancy,
          });

          fixedCount++;
        }
      } catch (error) {
        console.error(`[Fix Supplier Balances] Error fixing ${supplier.name}:`, error);
        errorCount++;
      }
    }

    console.log(`[Fix Supplier Balances] Completed: ${fixedCount} fixed, ${errorCount} errors`);

    return NextResponse.json({
      success: true,
      summary: {
        totalSuppliers: suppliers.length,
        fixedCount,
        errorCount,
      },
      fixes,
      message: `Successfully fixed ${fixedCount} supplier balances`,
    });
  } catch (error) {
    console.error("[Fix Supplier Balances] Fatal error:", error);
    return NextResponse.json(
      { error: "Failed to fix supplier balances", details: String(error) },
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

    const suppliers = await prisma.supplier.findMany({
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

    for (const supplier of suppliers) {
      // Calculate balance from actual transactions (not SupplierTransaction table)
      const [purchaseInvoices, payments, debitNotes, openingBalance] = await Promise.all([
        prisma.purchaseInvoice.aggregate({
          where: { supplierId: supplier.id },
          _sum: { total: true },
        }),
        prisma.supplierPayment.aggregate({
          where: { supplierId: supplier.id },
          _sum: { amount: true },
        }),
        prisma.debitNote.aggregate({
          where: { supplierId: supplier.id, appliedToBalance: true },
          _sum: { total: true },
        }),
        prisma.supplierTransaction.findFirst({
          where: { supplierId: supplier.id, transactionType: "OPENING_BALANCE" },
          select: { amount: true },
        }),
      ]);

      const purchaseTotal = Number(purchaseInvoices._sum.total || 0);
      const paymentTotal = Number(payments._sum.amount || 0);
      const debitNoteTotal = Number(debitNotes._sum.total || 0);
      const openingBalanceAmount = Number(openingBalance?.amount || 0);

      // Correct formula: opening + purchases - payments - debitNotes
      const calculatedBalance = openingBalanceAmount + purchaseTotal - paymentTotal - debitNoteTotal;

      const discrepancy = Number(supplier.balance) - calculatedBalance;

      if (Math.abs(discrepancy) > 0.01) {
        issues.push({
          id: supplier.id,
          name: supplier.name,
          storedBalance: Number(supplier.balance),
          calculatedBalance,
          difference: discrepancy,
        });
      }
    }

    return NextResponse.json({
      totalSuppliers: suppliers.length,
      suppliersWithIssues: issues.length,
      issues,
      message:
        issues.length > 0
          ? `Found ${issues.length} suppliers with balance discrepancies. Use POST to fix them.`
          : "All supplier balances are correct!",
    });
  } catch (error) {
    console.error("[Fix Supplier Balances] Error checking balances:", error);
    return NextResponse.json(
      { error: "Failed to check supplier balances", details: String(error) },
      { status: 500 }
    );
  }
}
