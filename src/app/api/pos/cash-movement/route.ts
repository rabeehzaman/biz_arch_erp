import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import {
  createAutoJournalEntry,
  getSystemAccount,
  getDefaultCashBankAccount,
  ensureSystemAccount,
} from "@/lib/accounting/journal";
import { generateAutoNumber } from "@/lib/accounting/auto-number";
import { getPOSRegisterConfig } from "@/lib/pos/register-config";

type Tx = any;

const CASH_OUT_REASONS = new Set(["EXPENSE", "SUPPLIER_PAYMENT", "OWNER_DRAWING"]);
const CASH_IN_REASONS = new Set(["OWNER_INVESTMENT", "OTHER_INCOME"]);

async function getCashAccount(
  tx: Tx,
  organizationId: string,
  isClearingMode: boolean,
  branchId: string | null,
  preferredCashAccountId?: string | null
): Promise<{ accountId: string; cashBankAccountId?: string }> {
  if (isClearingMode) {
    const clearing = await getSystemAccount(tx, organizationId, "1150");
    if (!clearing) throw new Error("POS Undeposited Funds account (1150) not found");
    return { accountId: clearing.id };
  }

  const cashBank = await getDefaultCashBankAccount(
    tx, organizationId, "CASH", branchId, preferredCashAccountId
  );
  if (!cashBank) throw new Error("No cash account found for this branch");
  return { accountId: cashBank.accountId, cashBankAccountId: cashBank.cashBankAccountId };
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const body = await request.json();
    const {
      sessionId,
      movementType,
      reason,
      amount,
      description,
      notes,
      supplierId,
      expenseAccountId,
    } = body;

    if (!sessionId || !movementType || !reason || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: sessionId, movementType, reason, amount" },
        { status: 400 }
      );
    }

    if (Number(amount) <= 0) {
      return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
    }

    // Validate reason matches movementType
    if (movementType === "CASH_OUT" && !CASH_OUT_REASONS.has(reason)) {
      return NextResponse.json(
        { error: `Invalid reason '${reason}' for CASH_OUT` },
        { status: 400 }
      );
    }
    if (movementType === "CASH_IN" && !CASH_IN_REASONS.has(reason)) {
      return NextResponse.json(
        { error: `Invalid reason '${reason}' for CASH_IN` },
        { status: 400 }
      );
    }

    // Validate conditional fields
    if (reason === "EXPENSE" && !expenseAccountId) {
      return NextResponse.json(
        { error: "Expense account is required for EXPENSE reason" },
        { status: 400 }
      );
    }
    if (reason === "SUPPLIER_PAYMENT" && !supplierId) {
      return NextResponse.json(
        { error: "Supplier is required for SUPPLIER_PAYMENT reason" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Validate session is OPEN
      const posSession = await tx.pOSSession.findFirst({
        where: { id: sessionId, organizationId, status: "OPEN" },
        select: { id: true, branchId: true, warehouseId: true },
      });
      if (!posSession) {
        throw new Error("POS session not found or already closed");
      }

      // Validate expense account if provided
      if (reason === "EXPENSE" && expenseAccountId) {
        const account = await tx.account.findFirst({
          where: { id: expenseAccountId, organizationId, accountType: "EXPENSE" },
          select: { id: true },
        });
        if (!account) throw new Error("Invalid expense account");
      }

      // Validate supplier if provided
      if (reason === "SUPPLIER_PAYMENT" && supplierId) {
        const supplier = await tx.supplier.findFirst({
          where: { id: supplierId, organizationId },
          select: { id: true },
        });
        if (!supplier) throw new Error("Supplier not found");
      }

      // Determine accounting mode
      const org = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { posAccountingMode: true, posDefaultCashAccountId: true },
      });
      const isClearingMode = org?.posAccountingMode === "CLEARING_ACCOUNT";

      const registerConfig = await getPOSRegisterConfig(
        tx, organizationId, posSession.branchId, posSession.warehouseId
      );

      // Get cash account (clearing 1150 or actual cash account)
      const cashAccount = await getCashAccount(
        tx, organizationId, isClearingMode,
        posSession.branchId,
        registerConfig?.defaultCashAccountId || org?.posDefaultCashAccountId
      );

      // Generate movement number
      const movementNumber = await generateAutoNumber(
        tx.pOSCashMovement, "movementNumber", "PCM", organizationId, tx
      );

      // Build journal entry lines based on reason
      const amountNum = Number(amount);
      const lines = await buildJournalLines(
        tx, organizationId, reason, amountNum, cashAccount.accountId, expenseAccountId
      );

      // Create journal entry
      const journalEntry = await createAutoJournalEntry(tx, organizationId, {
        date: new Date(),
        description: buildJournalDescription(movementType, reason, description),
        sourceType: "POS_CASH_MOVEMENT",
        sourceId: "", // Will update after creating the movement
        lines,
        branchId: posSession.branchId,
      });

      // Create the cash movement record
      const movement = await tx.pOSCashMovement.create({
        data: {
          movementNumber,
          organizationId,
          sessionId,
          userId: session.user!.id,
          movementType,
          reason,
          amount: amountNum,
          description: description || null,
          notes: notes || null,
          supplierId: reason === "SUPPLIER_PAYMENT" ? supplierId : null,
          expenseAccountId: reason === "EXPENSE" ? expenseAccountId : null,
          journalEntryId: journalEntry?.id || null,
          branchId: posSession.branchId,
        },
      });

      // Update journal entry sourceId to the movement ID
      if (journalEntry) {
        await tx.journalEntry.update({
          where: { id: journalEntry.id },
          data: { sourceId: movement.id },
        });
      }

      // Handle supplier payment audit trail
      if (reason === "SUPPLIER_PAYMENT" && supplierId) {
        // Decrement supplier balance
        await tx.supplier.update({
          where: { id: supplierId, organizationId },
          data: { balance: { decrement: amountNum } },
        });

        // Create SupplierTransaction record
        await tx.supplierTransaction.create({
          data: {
            supplierId,
            transactionType: "PAYMENT",
            transactionDate: new Date(),
            amount: -amountNum,
            description: `POS Cash Payment ${movementNumber}`,
            runningBalance: 0,
            organizationId,
          },
        });

        // FIFO auto-apply to oldest unpaid purchase invoices
        const unpaidInvoices = await tx.purchaseInvoice.findMany({
          where: {
            supplierId,
            organizationId,
            balanceDue: { gt: 0 },
          },
          orderBy: { invoiceDate: "asc" },
          select: { id: true, total: true, amountPaid: true, balanceDue: true },
        });

        let remainingAmount = amountNum;
        for (const invoice of unpaidInvoices) {
          if (remainingAmount <= 0) break;

          const balanceDue = Number(invoice.balanceDue);
          const applyAmount = Math.min(remainingAmount, balanceDue);
          const newAmountPaid = Number(invoice.amountPaid) + applyAmount;
          const newBalanceDue = Number(invoice.total) - newAmountPaid;
          const newStatus = newBalanceDue <= 0 ? "PAID" : "PARTIALLY_PAID";

          await tx.purchaseInvoice.update({
            where: { id: invoice.id, organizationId },
            data: {
              amountPaid: newAmountPaid,
              balanceDue: Math.max(0, newBalanceDue),
              status: newStatus,
            },
          });

          remainingAmount -= applyAmount;
        }
      }

      // In DIRECT mode, update cash/bank account balance
      if (!isClearingMode && cashAccount.cashBankAccountId) {
        if (movementType === "CASH_OUT") {
          await tx.cashBankAccount.update({
            where: { id: cashAccount.cashBankAccountId, organizationId },
            data: { balance: { decrement: amountNum } },
          });
          await tx.cashBankTransaction.create({
            data: {
              cashBankAccountId: cashAccount.cashBankAccountId,
              transactionType: "WITHDRAWAL",
              amount: -amountNum,
              runningBalance: 0,
              description: `POS ${reason.replace(/_/g, " ").toLowerCase()} - ${movementNumber}`,
              referenceType: "POS_CASH_MOVEMENT",
              referenceId: movement.id,
              transactionDate: new Date(),
              organizationId,
            },
          });
        } else {
          await tx.cashBankAccount.update({
            where: { id: cashAccount.cashBankAccountId, organizationId },
            data: { balance: { increment: amountNum } },
          });
          await tx.cashBankTransaction.create({
            data: {
              cashBankAccountId: cashAccount.cashBankAccountId,
              transactionType: "DEPOSIT",
              amount: amountNum,
              runningBalance: 0,
              description: `POS ${reason.replace(/_/g, " ").toLowerCase()} - ${movementNumber}`,
              referenceType: "POS_CASH_MOVEMENT",
              referenceId: movement.id,
              transactionDate: new Date(),
              organizationId,
            },
          });
        }
      }

      return movement;
    }, { timeout: 15000 });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("[POS Cash Movement] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create cash movement" },
      { status: 400 }
    );
  }
}

async function buildJournalLines(
  tx: Tx,
  organizationId: string,
  reason: string,
  amount: number,
  cashAccountId: string,
  expenseAccountId?: string
): Promise<{ accountId: string; description: string; debit: number; credit: number }[]> {
  switch (reason) {
    case "EXPENSE": {
      // DR Expense Account, CR Cash
      return [
        { accountId: expenseAccountId!, description: "POS Expense", debit: amount, credit: 0 },
        { accountId: cashAccountId, description: "POS Expense", debit: 0, credit: amount },
      ];
    }
    case "SUPPLIER_PAYMENT": {
      // DR Accounts Payable (2100), CR Cash
      const ap = await getSystemAccount(tx, organizationId, "2100");
      if (!ap) throw new Error("Accounts Payable account (2100) not found");
      return [
        { accountId: ap.id, description: "POS Supplier Payment", debit: amount, credit: 0 },
        { accountId: cashAccountId, description: "POS Supplier Payment", debit: 0, credit: amount },
      ];
    }
    case "OWNER_DRAWING": {
      // DR Owner's Drawings (3300), CR Cash
      const drawings = await ensureSystemAccount(tx, organizationId, "3300");
      return [
        { accountId: drawings.id, description: "Owner Drawing from POS", debit: amount, credit: 0 },
        { accountId: cashAccountId, description: "Owner Drawing from POS", debit: 0, credit: amount },
      ];
    }
    case "OWNER_INVESTMENT": {
      // DR Cash, CR Owner's Capital (3100)
      const capital = await ensureSystemAccount(tx, organizationId, "3100");
      return [
        { accountId: cashAccountId, description: "Owner Investment to POS", debit: amount, credit: 0 },
        { accountId: capital.id, description: "Owner Investment to POS", debit: 0, credit: amount },
      ];
    }
    case "OTHER_INCOME": {
      // DR Cash, CR Other Revenue (4900)
      const otherRevenue = await ensureSystemAccount(tx, organizationId, "4900");
      return [
        { accountId: cashAccountId, description: "POS Other Income", debit: amount, credit: 0 },
        { accountId: otherRevenue.id, description: "POS Other Income", debit: 0, credit: amount },
      ];
    }
    default:
      throw new Error(`Unknown reason: ${reason}`);
  }
}

function buildJournalDescription(
  movementType: string,
  reason: string,
  description?: string
): string {
  const reasonLabel = reason.replace(/_/g, " ").toLowerCase();
  const direction = movementType === "CASH_IN" ? "Cash In" : "Cash Out";
  const base = `POS ${direction} - ${reasonLabel}`;
  return description ? `${base}: ${description}` : base;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const movements = await prisma.pOSCashMovement.findMany({
      where: { organizationId, sessionId },
      orderBy: { createdAt: "desc" },
      include: {
        supplier: { select: { id: true, name: true } },
        expenseAccount: { select: { id: true, code: true, name: true } },
      },
    });

    return NextResponse.json(movements);
  } catch (error: any) {
    console.error("[POS Cash Movement] GET Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch cash movements" },
      { status: 500 }
    );
  }
}
