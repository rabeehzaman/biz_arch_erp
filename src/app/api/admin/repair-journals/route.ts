import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import {
  createAutoJournalEntry,
  getSystemAccount,
  getDefaultCashBankAccount,
} from "@/lib/accounting/journal";

/**
 * POST /api/admin/repair-journals
 *
 * Retroactively creates missing journal entries for transactions that were
 * recorded before the COA was seeded (or when journal entry creation silently
 * failed). Safe to run multiple times — it only creates entries where none exist.
 *
 * Returns counts of created entries per source type.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);

    const body = await request.json().catch(() => ({}));
    // Allow targeting a specific org (superadmin only) or default to caller's org
    const targetOrgId: string =
      session.user.role === "superadmin" && body.organizationId
        ? body.organizationId
        : organizationId;

    const counts = {
      invoices: 0,
      purchaseInvoices: 0,
      payments: 0,
      supplierPayments: 0,
      expenses: 0,
      errors: 0,
    };

    await prisma.$transaction(async (tx) => {
      // ── 1. Invoices ──────────────────────────────────────────────────────────
      const invoices = await tx.invoice.findMany({
        where: { organizationId: targetOrgId },
        include: { items: true },
      });

      const arAccount = await getSystemAccount(tx, targetOrgId, "1300");
      const revenueAccount = await getSystemAccount(tx, targetOrgId, "4100");
      const taxPayableAccount = await getSystemAccount(tx, targetOrgId, "2200");

      for (const invoice of invoices) {
        const existing = await tx.journalEntry.findFirst({
          where: {
            organizationId: targetOrgId,
            sourceType: "INVOICE",
            sourceId: invoice.id,
          },
        });
        if (existing) continue;

        if (!arAccount || !revenueAccount) {
          counts.errors++;
          continue;
        }

        const total = Number(invoice.total);
        const subtotal = Number(invoice.subtotal);
        const taxAmount = Number(invoice.taxAmount);

        const revenueLines: Array<{
          accountId: string;
          description: string;
          debit: number;
          credit: number;
        }> = [
          {
            accountId: arAccount.id,
            description: "Accounts Receivable",
            debit: total,
            credit: 0,
          },
          {
            accountId: revenueAccount.id,
            description: "Sales Revenue",
            debit: 0,
            credit: subtotal,
          },
        ];

        if (taxAmount > 0) {
          if (taxPayableAccount) {
            revenueLines.push({
              accountId: taxPayableAccount.id,
              description: "Tax Payable",
              debit: 0,
              credit: taxAmount,
            });
          } else {
            revenueLines[1] = {
              accountId: revenueAccount.id,
              description: "Sales Revenue",
              debit: 0,
              credit: total,
            };
          }
        }

        const entry = await createAutoJournalEntry(tx, targetOrgId, {
          date: invoice.issueDate,
          description: `[Repair] Sales Invoice ${invoice.invoiceNumber}`,
          sourceType: "INVOICE",
          sourceId: invoice.id,
          lines: revenueLines,
        });

        if (entry) counts.invoices++;
        else counts.errors++;
      }

      // ── 2. Purchase Invoices ──────────────────────────────────────────────────
      const purchaseInvoices = await tx.purchaseInvoice.findMany({
        where: {
          organizationId: targetOrgId,
          status: { in: ["RECEIVED", "PAID", "PARTIALLY_PAID"] },
        },
      });

      const inventoryAccount = await getSystemAccount(tx, targetOrgId, "1400");
      const apAccount = await getSystemAccount(tx, targetOrgId, "2100");
      const taxAccount2200 = await getSystemAccount(tx, targetOrgId, "2200");

      for (const pi of purchaseInvoices) {
        const existing = await tx.journalEntry.findFirst({
          where: {
            organizationId: targetOrgId,
            sourceType: "PURCHASE_INVOICE",
            sourceId: pi.id,
          },
        });
        if (existing) continue;

        if (!inventoryAccount || !apAccount) {
          counts.errors++;
          continue;
        }

        const total = Number(pi.total);
        const subtotal = Number(pi.subtotal);
        const taxAmount = Number(pi.taxAmount);

        const purchaseLines: Array<{
          accountId: string;
          description: string;
          debit: number;
          credit: number;
        }> = [
          {
            accountId: inventoryAccount.id,
            description: "Inventory",
            debit: subtotal,
            credit: 0,
          },
          {
            accountId: apAccount.id,
            description: "Accounts Payable",
            debit: 0,
            credit: total,
          },
        ];

        if (taxAmount > 0) {
          if (taxAccount2200) {
            purchaseLines.push({
              accountId: taxAccount2200.id,
              description: "Input Tax Recoverable",
              debit: taxAmount,
              credit: 0,
            });
          } else {
            purchaseLines[0] = {
              accountId: inventoryAccount.id,
              description: "Inventory",
              debit: total,
              credit: 0,
            };
          }
        }

        const entry = await createAutoJournalEntry(tx, targetOrgId, {
          date: pi.invoiceDate,
          description: `[Repair] Purchase Invoice ${pi.purchaseInvoiceNumber}`,
          sourceType: "PURCHASE_INVOICE",
          sourceId: pi.id,
          lines: purchaseLines,
        });

        if (entry) counts.purchaseInvoices++;
        else counts.errors++;
      }

      // ── 3. Customer Payments ──────────────────────────────────────────────────
      const payments = await tx.payment.findMany({
        where: { organizationId: targetOrgId },
      });

      const arAccountForPay = await getSystemAccount(tx, targetOrgId, "1300");

      for (const payment of payments) {
        const existing = await tx.journalEntry.findFirst({
          where: {
            organizationId: targetOrgId,
            sourceType: "PAYMENT",
            sourceId: payment.id,
          },
        });
        if (existing) continue;

        if (!arAccountForPay) {
          counts.errors++;
          continue;
        }

        const cashBankInfo = await getDefaultCashBankAccount(
          tx,
          targetOrgId,
          payment.paymentMethod
        );
        if (!cashBankInfo) {
          console.error(
            `[repair-journals] No cash/bank account for method "${payment.paymentMethod}" — skipping payment ${payment.paymentNumber}`
          );
          counts.errors++;
          continue;
        }

        const amount = Number(payment.amount);
        const discount = Number(payment.discountReceived);
        const totalSettlement = amount + discount;

        const paymentLines: Array<{
          accountId: string;
          description: string;
          debit: number;
          credit: number;
        }> = [
          {
            accountId: cashBankInfo.accountId,
            description: "Cash/Bank",
            debit: amount,
            credit: 0,
          },
          {
            accountId: arAccountForPay.id,
            description: "Accounts Receivable",
            debit: 0,
            credit: totalSettlement,
          },
        ];

        if (discount > 0) {
          const discountAccount = await getSystemAccount(tx, targetOrgId, "4200");
          if (discountAccount) {
            paymentLines.push({
              accountId: discountAccount.id,
              description: "Sales Discount Allowed",
              debit: discount,
              credit: 0,
            });
          } else {
            paymentLines[1] = {
              accountId: arAccountForPay.id,
              description: "Accounts Receivable",
              debit: 0,
              credit: amount,
            };
          }
        }

        const entry = await createAutoJournalEntry(tx, targetOrgId, {
          date: payment.paymentDate,
          description: `[Repair] Customer Payment ${payment.paymentNumber}`,
          sourceType: "PAYMENT",
          sourceId: payment.id,
          lines: paymentLines,
        });

        if (entry) counts.payments++;
        else counts.errors++;
      }

      // ── 4. Supplier Payments ──────────────────────────────────────────────────
      const supplierPayments = await tx.supplierPayment.findMany({
        where: { organizationId: targetOrgId },
      });

      const apAccountForPay = await getSystemAccount(tx, targetOrgId, "2100");

      for (const sp of supplierPayments) {
        const existing = await tx.journalEntry.findFirst({
          where: {
            organizationId: targetOrgId,
            sourceType: "SUPPLIER_PAYMENT",
            sourceId: sp.id,
          },
        });
        if (existing) continue;

        if (!apAccountForPay) {
          counts.errors++;
          continue;
        }

        const cashBankInfo = await getDefaultCashBankAccount(
          tx,
          targetOrgId,
          sp.paymentMethod
        );
        if (!cashBankInfo) {
          console.error(
            `[repair-journals] No cash/bank account for method "${sp.paymentMethod}" — skipping supplier payment ${sp.paymentNumber}`
          );
          counts.errors++;
          continue;
        }

        const amount = Number(sp.amount);
        const discount = Number(sp.discountGiven);
        const totalSettlement = amount + discount;

        const spLines: Array<{
          accountId: string;
          description: string;
          debit: number;
          credit: number;
        }> = [
          {
            accountId: apAccountForPay.id,
            description: "Accounts Payable",
            debit: totalSettlement,
            credit: 0,
          },
          {
            accountId: cashBankInfo.accountId,
            description: "Cash/Bank",
            debit: 0,
            credit: amount,
          },
        ];

        if (discount > 0) {
          const discountAccount = await getSystemAccount(tx, targetOrgId, "5600");
          if (discountAccount) {
            spLines.push({
              accountId: discountAccount.id,
              description: "Purchase Discount Received",
              debit: 0,
              credit: discount,
            });
          } else {
            spLines[0] = {
              accountId: apAccountForPay.id,
              description: "Accounts Payable",
              debit: amount,
              credit: 0,
            };
          }
        }

        const entry = await createAutoJournalEntry(tx, targetOrgId, {
          date: sp.paymentDate,
          description: `[Repair] Supplier Payment ${sp.paymentNumber}`,
          sourceType: "SUPPLIER_PAYMENT",
          sourceId: sp.id,
          lines: spLines,
        });

        if (entry) counts.supplierPayments++;
        else counts.errors++;
      }

      // ── 5. Paid Expenses ──────────────────────────────────────────────────────
      const expenses = await tx.expense.findMany({
        where: {
          organizationId: targetOrgId,
          status: "PAID",
          journalEntryId: null, // only those without a linked journal entry
        },
        include: {
          items: true,
          cashBankAccount: true,
        },
      });

      for (const expense of expenses) {
        // Double-check via sourceId in case journalEntryId link is missing
        const existing = await tx.journalEntry.findFirst({
          where: {
            organizationId: targetOrgId,
            sourceType: "EXPENSE",
            sourceId: expense.id,
          },
        });
        if (existing) continue;

        if (!expense.cashBankAccount) {
          console.error(
            `[repair-journals] Expense ${expense.expenseNumber} has no cash/bank account — skipping`
          );
          counts.errors++;
          continue;
        }

        const taxAmount = Number(expense.taxAmount);

        const expenseLines: Array<{
          accountId: string;
          description: string;
          debit: number;
          credit: number;
        }> = expense.items.map((item) => ({
          accountId: item.accountId,
          description: item.description,
          debit: Number(item.amount),
          credit: 0,
        }));

        if (taxAmount > 0) {
          const taxAcc = await tx.account.findFirst({
            where: { organizationId: targetOrgId, code: "2200" },
          });
          if (taxAcc) {
            expenseLines.push({
              accountId: taxAcc.id,
              description: "Tax",
              debit: taxAmount,
              credit: 0,
            });
          } else {
            // Fallback: roll into first expense line
            expenseLines[0] = {
              ...expenseLines[0],
              debit: expenseLines[0].debit + taxAmount,
            };
          }
        }

        expenseLines.push({
          accountId: expense.cashBankAccount.accountId,
          description: `Payment for ${expense.expenseNumber}`,
          debit: 0,
          credit: Number(expense.total),
        });

        const entry = await createAutoJournalEntry(tx, targetOrgId, {
          date: expense.expenseDate,
          description: `[Repair] Expense ${expense.expenseNumber}`,
          sourceType: "EXPENSE",
          sourceId: expense.id,
          lines: expenseLines,
        });

        if (entry) {
          // Update the expense to link the newly created journal entry
          await tx.expense.update({
            where: { id: expense.id },
            data: { journalEntryId: entry.id },
          });
          counts.expenses++;
        } else {
          counts.errors++;
        }
      }
    }, { timeout: 60000 }); // allow up to 60s for large datasets

    const totalCreated =
      counts.invoices +
      counts.purchaseInvoices +
      counts.payments +
      counts.supplierPayments +
      counts.expenses;

    return NextResponse.json({
      success: true,
      organizationId: targetOrgId,
      created: counts,
      totalCreated,
      message:
        totalCreated === 0 && counts.errors === 0
          ? "All journal entries are already present — nothing to repair."
          : `Created ${totalCreated} journal entr${totalCreated === 1 ? "y" : "ies"}${counts.errors > 0 ? ` (${counts.errors} skipped due to missing accounts)` : ""}.`,
    });
  } catch (error) {
    console.error("Failed to repair journal entries:", error);
    return NextResponse.json(
      { error: "Failed to repair journal entries" },
      { status: 500 }
    );
  }
}
