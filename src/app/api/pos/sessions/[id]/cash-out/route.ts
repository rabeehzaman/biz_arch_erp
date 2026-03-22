import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isSaudiEInvoiceEnabled } from "@/lib/auth-utils";
import {
  createAutoJournalEntry,
  getSystemAccount,
  getDefaultCashBankAccount,
} from "@/lib/accounting/journal";
import { generateAutoNumber } from "@/lib/accounting/auto-number";
import { getOrgGSTInfo, computeDocumentGST } from "@/lib/gst/document-gst";
import { SAUDI_VAT_RATE } from "@/lib/saudi-vat/constants";
import { getPOSRegisterConfig } from "@/lib/pos/register-config";
import { Session } from "next-auth";

/**
 * POS Cash-Out API
 *
 * Records cash going out of (or into) the POS register during a session.
 * Supports 4 types:
 *   - VENDOR_PAYMENT: Creates a SupplierPayment linked to the session
 *   - EXPENSE: Creates an Expense (auto-approved and paid) linked to the session
 *   - TRANSFER: Transfers cash to another cash/bank account, linked to the session
 *   - OTHER: Creates a POSCashMovement record for miscellaneous cash in/out
 */

// GET: List all cash movements for a session
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

    const posSession = await prisma.pOSSession.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!posSession) {
      return NextResponse.json({ error: "POS session not found" }, { status: 404 });
    }

    const [supplierPayments, expenses, transfers, cashMovements] = await Promise.all([
      prisma.supplierPayment.findMany({
        where: { organizationId, posSessionId: id },
        include: { supplier: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.expense.findMany({
        where: { organizationId, posSessionId: id },
        include: {
          items: { include: { account: { select: { id: true, code: true, name: true } } } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.cashBankTransaction.findMany({
        where: {
          organizationId,
          posSessionId: id,
          transactionType: { in: ["TRANSFER_OUT", "TRANSFER_IN"] },
        },
        include: { cashBankAccount: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.pOSCashMovement.findMany({
        where: { organizationId, sessionId: id },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      supplierPayments,
      expenses,
      transfers,
      cashMovements,
    });
  } catch (error) {
    console.error("Failed to fetch session cash movements:", error);
    return NextResponse.json(
      { error: "Failed to fetch session cash movements" },
      { status: 500 }
    );
  }
}

// POST: Create a cash-out (or cash-in) during a session
export async function POST(
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
    const { type } = body;

    // Validate session is open
    const posSession = await prisma.pOSSession.findFirst({
      where: { id, organizationId },
    });
    if (!posSession) {
      return NextResponse.json({ error: "POS session not found" }, { status: 404 });
    }
    if (posSession.status !== "OPEN") {
      return NextResponse.json(
        { error: "Cannot add cash movements to a closed session" },
        { status: 400 }
      );
    }

    switch (type) {
      case "VENDOR_PAYMENT":
        return handleVendorPayment(body, id, organizationId, posSession);
      case "EXPENSE":
        return handleExpense(body, id, organizationId, session as Session);
      case "TRANSFER":
        return handleTransfer(body, id, organizationId, posSession);
      case "OTHER":
        return handleOtherCashMovement(body, id, organizationId, posSession);
      default:
        return NextResponse.json(
          { error: "Invalid type. Must be VENDOR_PAYMENT, EXPENSE, TRANSFER, or OTHER" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Failed to create POS cash movement:", error);
    const message = error instanceof Error ? error.message : "Failed to create cash movement";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Handle vendor payment from POS register
 */
async function handleVendorPayment(
  body: Record<string, unknown>,
  sessionId: string,
  organizationId: string,
  posSession: { branchId: string | null; warehouseId: string | null }
) {
  const {
    supplierId,
    amount,
    purchaseInvoiceId,
    reference,
    notes,
    discountGiven: rawDiscount,
  } = body as {
    supplierId?: string;
    amount?: number;
    purchaseInvoiceId?: string;
    reference?: string;
    notes?: string;
    discountGiven?: number;
  };

  if (!supplierId || !amount || amount <= 0) {
    return NextResponse.json(
      { error: "Supplier and positive amount are required" },
      { status: 400 }
    );
  }

  const discountGiven = rawDiscount || 0;

  const result = await prisma.$transaction(async (tx) => {
    // Generate payment number
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const prefix = `SPAY-${dateStr}`;
    const lastPayment = await tx.supplierPayment.findFirst({
      where: { paymentNumber: { startsWith: prefix }, organizationId },
      orderBy: { paymentNumber: "desc" },
    });
    let sequence = 1;
    if (lastPayment) {
      const lastSequence = parseInt(lastPayment.paymentNumber.split("-").pop() || "0");
      sequence = lastSequence + 1;
    }
    const paymentNumber = `${prefix}-${sequence.toString().padStart(3, "0")}`;

    // Create supplier payment linked to POS session
    const payment = await tx.supplierPayment.create({
      data: {
        paymentNumber,
        supplierId,
        purchaseInvoiceId: purchaseInvoiceId || null,
        amount,
        discountGiven,
        paymentDate: today,
        paymentMethod: "CASH",
        reference: reference || null,
        notes: notes || null,
        posSessionId: sessionId,
        branchId: posSession.branchId,
        organizationId,
      },
    });

    const totalSettlement = Number(amount) + Number(discountGiven);

    // Update supplier balance
    await tx.supplier.update({
      where: { id: supplierId, organizationId },
      data: { balance: { decrement: totalSettlement } },
    });

    // Journal entry: DR AP, CR Cash
    const apAccount = await getSystemAccount(tx, organizationId, "2100");
    const registerConfig = await getPOSRegisterConfig(tx, organizationId, posSession.branchId, posSession.warehouseId);
    const cashBankInfo = await getDefaultCashBankAccount(tx, organizationId, "CASH", posSession.branchId, registerConfig?.defaultCashAccountId);

    if (apAccount && cashBankInfo) {
      const lines: Array<{ accountId: string; description: string; debit: number; credit: number }> = [
        { accountId: apAccount.id, description: "Accounts Payable", debit: totalSettlement, credit: 0 },
        { accountId: cashBankInfo.accountId, description: "Cash", debit: 0, credit: Number(amount) },
      ];

      if (Number(discountGiven) > 0) {
        const discountAccount = await getSystemAccount(tx, organizationId, "5600");
        if (discountAccount) {
          lines.push({ accountId: discountAccount.id, description: "Purchase Discount Received", debit: 0, credit: Number(discountGiven) });
        }
      }

      await createAutoJournalEntry(tx, organizationId, {
        date: today,
        description: `POS Vendor Payment ${paymentNumber}`,
        sourceType: "SUPPLIER_PAYMENT",
        sourceId: payment.id,
        branchId: posSession.branchId,
        lines,
      });

      // Update cash balance
      await tx.cashBankAccount.update({
        where: { id: cashBankInfo.cashBankAccountId, organizationId },
        data: { balance: { decrement: Number(amount) } },
      });
      const updatedCB = await tx.cashBankAccount.findUnique({ where: { id: cashBankInfo.cashBankAccountId } });
      await tx.cashBankTransaction.create({
        data: {
          cashBankAccountId: cashBankInfo.cashBankAccountId,
          transactionType: "WITHDRAWAL",
          amount: -Number(amount),
          runningBalance: Number(updatedCB?.balance || 0),
          description: `POS Vendor Payment ${paymentNumber}`,
          referenceType: "SUPPLIER_PAYMENT",
          referenceId: payment.id,
          transactionDate: today,
          posSessionId: sessionId,
          organizationId,
        },
      });
    }

    // Create supplier transaction record
    await tx.supplierTransaction.create({
      data: {
        supplierId,
        transactionType: "PAYMENT",
        transactionDate: today,
        amount: -totalSettlement,
        description: `POS Payment ${paymentNumber}`,
        supplierPaymentId: payment.id,
        runningBalance: 0,
        organizationId,
      },
    });

    // Auto-allocate to invoices (FIFO if no specific invoice)
    if (purchaseInvoiceId) {
      const invoice = await tx.purchaseInvoice.findUnique({
        where: { id: purchaseInvoiceId, organizationId },
        select: { id: true, total: true, amountPaid: true, balanceDue: true },
      });
      if (invoice) {
        const applyAmount = Math.min(totalSettlement, Number(invoice.balanceDue));
        const newAmountPaid = Number(invoice.amountPaid) + applyAmount;
        const newBalanceDue = Number(invoice.total) - newAmountPaid;
        await tx.purchaseInvoice.update({
          where: { id: purchaseInvoiceId, organizationId },
          data: {
            amountPaid: newAmountPaid,
            balanceDue: Math.max(0, newBalanceDue),
            status: newBalanceDue <= 0 ? "PAID" : "PARTIALLY_PAID",
          },
        });
        await tx.supplierPaymentAllocation.create({
          data: { supplierPaymentId: payment.id, purchaseInvoiceId, amount: applyAmount, organizationId },
        });
      }
    } else {
      const unpaidInvoices = await tx.purchaseInvoice.findMany({
        where: { supplierId, organizationId, balanceDue: { gt: 0 } },
        orderBy: { invoiceDate: "asc" },
        select: { id: true, total: true, amountPaid: true, balanceDue: true },
      });
      let remaining = totalSettlement;
      for (const invoice of unpaidInvoices) {
        if (remaining <= 0) break;
        const applyAmount = Math.min(remaining, Number(invoice.balanceDue));
        const newAmountPaid = Number(invoice.amountPaid) + applyAmount;
        const newBalanceDue = Number(invoice.total) - newAmountPaid;
        await tx.purchaseInvoice.update({
          where: { id: invoice.id, organizationId },
          data: {
            amountPaid: newAmountPaid,
            balanceDue: Math.max(0, newBalanceDue),
            status: newBalanceDue <= 0 ? "PAID" : "PARTIALLY_PAID",
          },
        });
        await tx.supplierPaymentAllocation.create({
          data: { supplierPaymentId: payment.id, purchaseInvoiceId: invoice.id, amount: applyAmount, organizationId },
        });
        remaining -= applyAmount;
      }
    }

    return payment;
  }, { timeout: 60000 });

  return NextResponse.json({ type: "VENDOR_PAYMENT", data: result }, { status: 201 });
}

/**
 * Handle expense paid from POS register (auto-approve + pay)
 */
async function handleExpense(
  body: Record<string, unknown>,
  sessionId: string,
  organizationId: string,
  authSession: Session
) {
  const {
    items,
    description,
    supplierId,
    notes,
    branchId,
  } = body as {
    items?: Array<{ accountId: string; description: string; amount: number; gstRate?: number; vatRate?: number }>;
    description?: string;
    supplierId?: string;
    notes?: string;
    branchId?: string;
  };

  if (!items || items.length === 0) {
    return NextResponse.json(
      { error: "At least one expense item is required" },
      { status: 400 }
    );
  }

  const posSession = await prisma.pOSSession.findFirst({
    where: { id: sessionId, organizationId },
  });

  const result = await prisma.$transaction(async (tx) => {
    const expenseNumber = await generateAutoNumber(
      tx.expense as never,
      "expenseNumber",
      "EXP",
      organizationId
    );

    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);

    // Compute tax
    const saudiEnabled = isSaudiEInvoiceEnabled(authSession);
    let totalCgst = 0, totalSgst = 0, totalIgst = 0;
    let totalVat: number | null = null;
    let placeOfSupply: string | null = null;
    let isInterState = false;
    let lineGST: Array<{ gstRate: number; cgstAmount: number; sgstAmount: number; igstAmount: number }> = [];

    if (saudiEnabled) {
      let vatTotal = 0;
      for (const item of items) {
        const rate = item.vatRate !== undefined ? Number(item.vatRate) : SAUDI_VAT_RATE;
        vatTotal += item.amount * rate / 100;
      }
      totalVat = Math.round(vatTotal * 100) / 100;
    } else {
      const orgGST = await getOrgGSTInfo(tx, organizationId);
      let supplierGstin: string | null = null;
      let supplierStateCode: string | null = null;
      if (supplierId) {
        const supplier = await tx.supplier.findUnique({
          where: { id: supplierId },
          select: { gstin: true, gstStateCode: true },
        });
        supplierGstin = supplier?.gstin ?? null;
        supplierStateCode = supplier?.gstStateCode ?? null;
      }
      const lineItemsForGST = items.map((item) => ({
        taxableAmount: item.amount,
        gstRate: item.gstRate || 0,
        hsnCode: null,
      }));
      const gstResult = computeDocumentGST(orgGST, lineItemsForGST, supplierGstin, supplierStateCode);
      totalCgst = gstResult.totalCgst;
      totalSgst = gstResult.totalSgst;
      totalIgst = gstResult.totalIgst;
      placeOfSupply = gstResult.placeOfSupply;
      isInterState = gstResult.isInterState;
      lineGST = gstResult.lineGST;
    }

    const totalTax = totalVat !== null ? totalVat : (totalCgst + totalSgst + totalIgst);
    const total = subtotal + totalTax;
    const now = new Date();

    // Get POS register cash account
    const registerConfig = await getPOSRegisterConfig(tx, organizationId, posSession?.branchId ?? null, posSession?.warehouseId ?? null);
    const cashBankInfo = await getDefaultCashBankAccount(tx, organizationId, "CASH", posSession?.branchId ?? null, registerConfig?.defaultCashAccountId);

    if (!cashBankInfo) {
      throw new Error("No cash account found for POS register");
    }

    // Create expense as PAID (skip draft/approve workflow for POS)
    const expense = await tx.expense.create({
      data: {
        expenseNumber,
        status: "PAID",
        supplierId: supplierId || null,
        cashBankAccountId: cashBankInfo.cashBankAccountId,
        expenseDate: now,
        description: description || null,
        subtotal,
        total,
        totalCgst: saudiEnabled ? 0 : totalCgst,
        totalSgst: saudiEnabled ? 0 : totalSgst,
        totalIgst: saudiEnabled ? 0 : totalIgst,
        placeOfSupply: saudiEnabled ? null : placeOfSupply,
        isInterState: saudiEnabled ? false : isInterState,
        totalVat: saudiEnabled ? totalVat : null,
        notes: notes || null,
        posSessionId: sessionId,
        branchId: branchId || posSession?.branchId || null,
        organizationId,
        items: {
          create: items.map((item, idx) => ({
            accountId: item.accountId,
            description: item.description,
            amount: item.amount,
            gstRate: saudiEnabled ? 0 : (lineGST[idx]?.gstRate || 0),
            cgstAmount: saudiEnabled ? 0 : (lineGST[idx]?.cgstAmount || 0),
            sgstAmount: saudiEnabled ? 0 : (lineGST[idx]?.sgstAmount || 0),
            igstAmount: saudiEnabled ? 0 : (lineGST[idx]?.igstAmount || 0),
            organizationId,
          })),
        },
      },
      include: {
        items: { include: { account: { select: { id: true, code: true, name: true } } } },
      },
    });

    // Journal entry: DR expense accounts, CR cash
    const journalLines = expense.items.map((item) => ({
      accountId: item.accountId,
      description: item.description,
      debit: Number(item.amount),
      credit: 0,
    }));

    // Add GST input tax debits
    if (!saudiEnabled) {
      if (totalCgst > 0) {
        const cgstAccount = await tx.account.findFirst({ where: { organizationId, code: "1350" } });
        if (cgstAccount) journalLines.push({ accountId: cgstAccount.id, description: "CGST Input", debit: totalCgst, credit: 0 });
      }
      if (totalSgst > 0) {
        const sgstAccount = await tx.account.findFirst({ where: { organizationId, code: "1360" } });
        if (sgstAccount) journalLines.push({ accountId: sgstAccount.id, description: "SGST Input", debit: totalSgst, credit: 0 });
      }
      if (totalIgst > 0) {
        const igstAccount = await tx.account.findFirst({ where: { organizationId, code: "1370" } });
        if (igstAccount) journalLines.push({ accountId: igstAccount.id, description: "IGST Input", debit: totalIgst, credit: 0 });
      }
    }

    journalLines.push({
      accountId: cashBankInfo.accountId,
      description: `POS Expense ${expenseNumber}`,
      debit: 0,
      credit: total,
    });

    const journalEntry = await createAutoJournalEntry(tx, organizationId, {
      date: now,
      description: `POS Expense ${expenseNumber}${description ? `: ${description}` : ""}`,
      sourceType: "EXPENSE",
      sourceId: expense.id,
      branchId: branchId || posSession?.branchId || null,
      lines: journalLines,
    });

    // Update expense with journal entry link
    if (journalEntry) {
      await tx.expense.update({
        where: { id: expense.id, organizationId },
        data: { journalEntryId: journalEntry.id },
      });
    }

    // Update cash balance
    await tx.cashBankAccount.update({
      where: { id: cashBankInfo.cashBankAccountId, organizationId },
      data: { balance: { decrement: total } },
    });
    const updatedCB = await tx.cashBankAccount.findUnique({ where: { id: cashBankInfo.cashBankAccountId } });
    await tx.cashBankTransaction.create({
      data: {
        cashBankAccountId: cashBankInfo.cashBankAccountId,
        transactionType: "WITHDRAWAL",
        amount: -total,
        runningBalance: Number(updatedCB?.balance || 0),
        description: `POS Expense ${expenseNumber}`,
        referenceType: "EXPENSE",
        referenceId: expense.id,
        transactionDate: now,
        posSessionId: sessionId,
        organizationId,
      },
    });

    return expense;
  }, { timeout: 60000 });

  return NextResponse.json({ type: "EXPENSE", data: result }, { status: 201 });
}

/**
 * Handle transfer from POS register to another cash/bank account
 */
async function handleTransfer(
  body: Record<string, unknown>,
  sessionId: string,
  organizationId: string,
  posSession: { branchId: string | null; warehouseId: string | null }
) {
  const {
    toAccountId,
    amount,
    description,
  } = body as {
    toAccountId?: string;
    amount?: number;
    description?: string;
  };

  if (!toAccountId || !amount || amount <= 0) {
    return NextResponse.json(
      { error: "Destination account and positive amount are required" },
      { status: 400 }
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    // Get source (POS register cash account)
    const registerConfig = await getPOSRegisterConfig(tx, organizationId, posSession.branchId, posSession.warehouseId);
    const cashBankInfo = await getDefaultCashBankAccount(tx, organizationId, "CASH", posSession.branchId, registerConfig?.defaultCashAccountId);

    if (!cashBankInfo) {
      throw new Error("No cash account found for POS register");
    }

    const toAccount = await tx.cashBankAccount.findFirst({
      where: { id: toAccountId, organizationId, isActive: true },
    });
    if (!toAccount) throw new Error("Destination account not found or inactive");

    if (cashBankInfo.cashBankAccountId === toAccountId) {
      throw new Error("Cannot transfer to the same account");
    }

    const now = new Date();
    const transferAmount = Number(amount);
    const desc = description || `POS Transfer to ${toAccount.name}`;

    const newFromBalance = Number(
      (await tx.cashBankAccount.findUnique({ where: { id: cashBankInfo.cashBankAccountId } }))?.balance ?? 0
    ) - transferAmount;
    const newToBalance = Number(toAccount.balance) + transferAmount;

    // Update balances
    await tx.cashBankAccount.update({
      where: { id: cashBankInfo.cashBankAccountId, organizationId },
      data: { balance: newFromBalance },
    });
    await tx.cashBankAccount.update({
      where: { id: toAccountId, organizationId },
      data: { balance: newToBalance },
    });

    // Create transactions
    const fromTx = await tx.cashBankTransaction.create({
      data: {
        cashBankAccountId: cashBankInfo.cashBankAccountId,
        transactionType: "TRANSFER_OUT",
        amount: -transferAmount,
        runningBalance: newFromBalance,
        description: desc,
        referenceType: "TRANSFER",
        referenceId: toAccountId,
        transactionDate: now,
        posSessionId: sessionId,
        organizationId,
      },
    });

    await tx.cashBankTransaction.create({
      data: {
        cashBankAccountId: toAccountId,
        transactionType: "TRANSFER_IN",
        amount: transferAmount,
        runningBalance: newToBalance,
        description: desc,
        referenceType: "TRANSFER",
        referenceId: cashBankInfo.cashBankAccountId,
        transactionDate: now,
        posSessionId: sessionId,
        organizationId,
      },
    });

    // Journal entry: Debit destination, Credit source
    if (toAccount.accountId) {
      await createAutoJournalEntry(tx, organizationId, {
        date: now,
        description: desc,
        sourceType: "TRANSFER",
        sourceId: fromTx.id,
        branchId: posSession.branchId,
        lines: [
          { accountId: toAccount.accountId, debit: transferAmount, credit: 0 },
          { accountId: cashBankInfo.accountId, debit: 0, credit: transferAmount },
        ],
      });
    }

    return { fromBalance: newFromBalance, toBalance: newToBalance, transactionId: fromTx.id };
  }, { timeout: 60000 });

  return NextResponse.json({ type: "TRANSFER", data: result }, { status: 201 });
}

/**
 * Handle other/miscellaneous cash in/out
 */
async function handleOtherCashMovement(
  body: Record<string, unknown>,
  sessionId: string,
  organizationId: string,
  posSession: { branchId: string | null; warehouseId: string | null }
) {
  const {
    movementType,
    amount,
    reason,
    accountId,
  } = body as {
    movementType?: "CASH_IN" | "CASH_OUT";
    amount?: number;
    reason?: string;
    accountId?: string;
  };

  if (!movementType || !["CASH_IN", "CASH_OUT"].includes(movementType)) {
    return NextResponse.json(
      { error: "movementType must be CASH_IN or CASH_OUT" },
      { status: 400 }
    );
  }
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Positive amount is required" }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: "Reason is required" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const now = new Date();

    // Get POS register cash account
    const registerConfig = await getPOSRegisterConfig(tx, organizationId, posSession.branchId, posSession.warehouseId);
    const cashBankInfo = await getDefaultCashBankAccount(tx, organizationId, "CASH", posSession.branchId, registerConfig?.defaultCashAccountId);

    let journalEntryId: string | null = null;

    // Create journal entry if an offsetting account is provided
    if (cashBankInfo && accountId) {
      const offsetAccount = await tx.account.findFirst({ where: { id: accountId, organizationId } });
      if (offsetAccount) {
        const lines = movementType === "CASH_OUT"
          ? [
              { accountId: accountId, description: reason, debit: Number(amount), credit: 0 },
              { accountId: cashBankInfo.accountId, description: "Cash", debit: 0, credit: Number(amount) },
            ]
          : [
              { accountId: cashBankInfo.accountId, description: "Cash", debit: Number(amount), credit: 0 },
              { accountId: accountId, description: reason, debit: 0, credit: Number(amount) },
            ];

        const je = await createAutoJournalEntry(tx, organizationId, {
          date: now,
          description: `POS ${movementType === "CASH_OUT" ? "Cash Out" : "Cash In"}: ${reason}`,
          sourceType: "POS_CASH_MOVEMENT",
          sourceId: sessionId,
          branchId: posSession.branchId,
          lines,
        });
        journalEntryId = je?.id || null;
      }
    }

    // Update cash balance
    if (cashBankInfo) {
      const balanceChange = movementType === "CASH_OUT" ? -Number(amount) : Number(amount);
      await tx.cashBankAccount.update({
        where: { id: cashBankInfo.cashBankAccountId, organizationId },
        data: { balance: { increment: balanceChange } },
      });
      const updatedCB = await tx.cashBankAccount.findUnique({ where: { id: cashBankInfo.cashBankAccountId } });
      await tx.cashBankTransaction.create({
        data: {
          cashBankAccountId: cashBankInfo.cashBankAccountId,
          transactionType: movementType === "CASH_OUT" ? "WITHDRAWAL" : "DEPOSIT",
          amount: balanceChange,
          runningBalance: Number(updatedCB?.balance || 0),
          description: `POS ${movementType === "CASH_OUT" ? "Cash Out" : "Cash In"}: ${reason}`,
          referenceType: "POS_CASH_MOVEMENT",
          transactionDate: now,
          posSessionId: sessionId,
          organizationId,
        },
      });
    }

    // Create POSCashMovement record
    const movement = await tx.pOSCashMovement.create({
      data: {
        sessionId,
        type: movementType,
        amount: Number(amount),
        reason,
        journalEntryId,
        organizationId,
      },
    });

    return movement;
  }, { timeout: 60000 });

  return NextResponse.json({ type: "OTHER", data: result }, { status: 201 });
}
