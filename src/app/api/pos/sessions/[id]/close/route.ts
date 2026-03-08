import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import {
  createAutoJournalEntry,
  getDefaultCashBankAccount,
  getSystemAccount,
} from "@/lib/accounting/journal";
import { getPOSRegisterConfig } from "@/lib/pos/register-config";

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

    // Validate session belongs to org and is OPEN
    const posSession = await prisma.pOSSession.findFirst({
      where: { id, organizationId },
    });

    if (!posSession) {
      return NextResponse.json({ error: "POS session not found" }, { status: 404 });
    }

    if (posSession.status !== "OPEN") {
      return NextResponse.json(
        { error: "This session is already closed" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { closingCash, notes, settleCashAccountId, settleBankAccountId } = body;

    if (closingCash === undefined || closingCash === null) {
      return NextResponse.json(
        { error: "Closing cash amount is required" },
        { status: 400 }
      );
    }

    // Fetch org settings
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { posAccountingMode: true },
    });
    const isClearingMode = org?.posAccountingMode === "CLEARING_ACCOUNT";
    const registerConfig = await getPOSRegisterConfig(
      prisma,
      organizationId,
      posSession.branchId,
      posSession.warehouseId
    );
    const hasSettleCashAccountId = Object.prototype.hasOwnProperty.call(body, "settleCashAccountId");
    const hasSettleBankAccountId = Object.prototype.hasOwnProperty.call(body, "settleBankAccountId");
    const effectiveSettleCashAccountId = hasSettleCashAccountId
      ? settleCashAccountId || null
      : registerConfig?.defaultCashAccountId || null;
    const effectiveSettleBankAccountId = hasSettleBankAccountId
      ? settleBankAccountId || null
      : registerConfig?.defaultBankAccountId || null;

    // Validate settlement accounts are required in clearing mode
    if (isClearingMode && !effectiveSettleCashAccountId) {
      return NextResponse.json(
        { error: "Cash settlement account is required in clearing account mode" },
        { status: 400 }
      );
    }
    if (isClearingMode && effectiveSettleCashAccountId) {
      const validCashSettlement = await prisma.cashBankAccount.findFirst({
        where: {
          id: effectiveSettleCashAccountId,
          organizationId,
          isActive: true,
          accountSubType: "CASH",
        },
        select: { id: true },
      });

      if (!validCashSettlement) {
        return NextResponse.json(
          { error: "Selected cash settlement account is invalid or inactive" },
          { status: 400 }
        );
      }
    }
    if (effectiveSettleBankAccountId) {
      const validBankSettlement = await prisma.cashBankAccount.findFirst({
        where: {
          id: effectiveSettleBankAccountId,
          organizationId,
          isActive: true,
          accountSubType: "BANK",
        },
        select: { id: true },
      });

      if (!validBankSettlement) {
        return NextResponse.json(
          { error: "Selected bank settlement account is invalid or inactive" },
          { status: 400 }
        );
      }
    }

    // Use a transaction for all close operations
    const result = await prisma.$transaction(async (tx) => {
      // Calculate expected cash: openingCash + sum of all CASH payments on invoices in this session
      const cashPayments = await tx.payment.aggregate({
        where: {
          organizationId,
          invoice: { posSessionId: id },
          paymentMethod: "CASH",
        },
        _sum: { amount: true },
      });

      const cashReceived = Number(cashPayments._sum.amount || 0);
      const expectedCash = Number(posSession.openingCash) + cashReceived;
      const cashDifference = Number(closingCash) - expectedCash;

      // Aggregate non-cash payments
      const nonCashPayments = await tx.payment.aggregate({
        where: {
          organizationId,
          invoice: { posSessionId: id },
          paymentMethod: { not: "CASH" },
        },
        _sum: { amount: true },
      });
      const nonCashTotal = Number(nonCashPayments._sum.amount || 0);

      // Aggregate totals from invoices in this session
      const invoiceAggregates = await tx.invoice.aggregate({
        where: { organizationId, posSessionId: id },
        _sum: { total: true },
        _count: { id: true },
      });

      const totalSales = Number(invoiceAggregates._sum.total || 0);
      const totalTransactions = invoiceAggregates._count.id;
      const now = new Date();

      // ── Settlement logic ──────────────────────────────────────────────
      if (isClearingMode) {
        const clearingAccount = await getSystemAccount(tx, organizationId, "1150");
        const cashShortOverAccount = await getSystemAccount(tx, organizationId, "6150");

        // Step A: Transfer declared cash from Clearing Account → selected Cash account
        const netCashDeposit = Number(closingCash) - Number(posSession.openingCash);
        if (netCashDeposit > 0 && effectiveSettleCashAccountId) {
          const cashCBA = await tx.cashBankAccount.findFirst({
            where: { id: effectiveSettleCashAccountId, organizationId, isActive: true },
            select: { id: true, accountId: true },
          });

          if (cashCBA && clearingAccount) {
            await createAutoJournalEntry(tx, organizationId, {
              date: now,
              description: `POS Session Close - Cash Deposit (${posSession.sessionNumber})`,
              sourceType: "POS_SESSION_CLOSE",
              sourceId: id,
              branchId: posSession.branchId,
              lines: [
                { accountId: cashCBA.accountId, description: "Cash Account", debit: netCashDeposit, credit: 0 },
                { accountId: clearingAccount.id, description: "POS Undeposited Funds", debit: 0, credit: netCashDeposit },
              ],
            });

            // Update CashBankAccount balance
            await tx.cashBankAccount.update({
              where: { id: cashCBA.id },
              data: { balance: { increment: netCashDeposit } },
            });

            const updatedCB = await tx.cashBankAccount.findUnique({ where: { id: cashCBA.id } });
            await tx.cashBankTransaction.create({
              data: {
                cashBankAccountId: cashCBA.id,
                transactionType: "DEPOSIT",
                amount: netCashDeposit,
                runningBalance: Number(updatedCB?.balance || 0),
                description: `POS Session Close - Cash Deposit (${posSession.sessionNumber})`,
                referenceType: "POS_SESSION",
                referenceId: id,
                transactionDate: now,
                organizationId,
              },
            });
          }
        }

        // Step B: Transfer non-cash payments from Clearing Account → selected Bank account
        if (nonCashTotal > 0 && effectiveSettleBankAccountId) {
          const bankCBA = await tx.cashBankAccount.findFirst({
            where: { id: effectiveSettleBankAccountId, organizationId, isActive: true },
            select: { id: true, accountId: true },
          });

          if (bankCBA && clearingAccount) {
            await createAutoJournalEntry(tx, organizationId, {
              date: now,
              description: `POS Session Close - Non-Cash Deposit (${posSession.sessionNumber})`,
              sourceType: "POS_SESSION_CLOSE",
              sourceId: id,
              branchId: posSession.branchId,
              lines: [
                { accountId: bankCBA.accountId, description: "Bank Account", debit: nonCashTotal, credit: 0 },
                { accountId: clearingAccount.id, description: "POS Undeposited Funds", debit: 0, credit: nonCashTotal },
              ],
            });

            await tx.cashBankAccount.update({
              where: { id: bankCBA.id },
              data: { balance: { increment: nonCashTotal } },
            });

            const updatedBank = await tx.cashBankAccount.findUnique({ where: { id: bankCBA.id } });
            await tx.cashBankTransaction.create({
              data: {
                cashBankAccountId: bankCBA.id,
                transactionType: "DEPOSIT",
                amount: nonCashTotal,
                runningBalance: Number(updatedBank?.balance || 0),
                description: `POS Session Close - Non-Cash Deposit (${posSession.sessionNumber})`,
                referenceType: "POS_SESSION",
                referenceId: id,
                transactionDate: now,
                organizationId,
              },
            });
          }
        } else if (nonCashTotal > 0 && effectiveSettleCashAccountId && !effectiveSettleBankAccountId) {
          // Fallback: cashier explicitly chose the "__use_cash_account__" sentinel for bank
          // settlement (meaning no separate bank account is configured). Per business intent,
          // all non-cash receipts (card, bank-transfer, etc.) are physically handed to a bank
          // later from the cash drawer, so they are deposited into the same cash account here
          // until a proper bank deposit is recorded separately.
          const fallbackCBA = await tx.cashBankAccount.findFirst({
            where: { id: effectiveSettleCashAccountId, organizationId, isActive: true },
            select: { id: true, accountId: true },
          });

          if (fallbackCBA && clearingAccount) {
            await createAutoJournalEntry(tx, organizationId, {
              date: now,
              description: `POS Session Close - Non-Cash Deposit (${posSession.sessionNumber})`,
              sourceType: "POS_SESSION_CLOSE",
              sourceId: id,
              branchId: posSession.branchId,
              lines: [
                { accountId: fallbackCBA.accountId, description: "Cash/Bank Account", debit: nonCashTotal, credit: 0 },
                { accountId: clearingAccount.id, description: "POS Undeposited Funds", debit: 0, credit: nonCashTotal },
              ],
            });

            await tx.cashBankAccount.update({
              where: { id: fallbackCBA.id },
              data: { balance: { increment: nonCashTotal } },
            });

            const updatedFallback = await tx.cashBankAccount.findUnique({ where: { id: fallbackCBA.id } });
            await tx.cashBankTransaction.create({
              data: {
                cashBankAccountId: fallbackCBA.id,
                transactionType: "DEPOSIT",
                amount: nonCashTotal,
                runningBalance: Number(updatedFallback?.balance || 0),
                description: `POS Session Close - Non-Cash Deposit (${posSession.sessionNumber})`,
                referenceType: "POS_SESSION",
                referenceId: id,
                transactionDate: now,
                organizationId,
              },
            });
          }
        }

        // Step C: Handle cash difference (clearing mode)
        if (Math.abs(cashDifference) >= 0.01 && clearingAccount && cashShortOverAccount) {
          if (cashDifference < 0) {
            // Shortage: DR Cash Short & Over, CR POS Undeposited Funds
            await createAutoJournalEntry(tx, organizationId, {
              date: now,
              description: `POS Cash Shortage (${posSession.sessionNumber})`,
              sourceType: "POS_SESSION_CLOSE",
              sourceId: id,
              branchId: posSession.branchId,
              lines: [
                { accountId: cashShortOverAccount.id, description: "Cash Short and Over", debit: Math.abs(cashDifference), credit: 0 },
                { accountId: clearingAccount.id, description: "POS Undeposited Funds", debit: 0, credit: Math.abs(cashDifference) },
              ],
            });
          } else {
            // Overage: DR POS Undeposited Funds, CR Cash Short & Over
            await createAutoJournalEntry(tx, organizationId, {
              date: now,
              description: `POS Cash Overage (${posSession.sessionNumber})`,
              sourceType: "POS_SESSION_CLOSE",
              sourceId: id,
              branchId: posSession.branchId,
              lines: [
                { accountId: clearingAccount.id, description: "POS Undeposited Funds", debit: cashDifference, credit: 0 },
                { accountId: cashShortOverAccount.id, description: "Cash Short and Over", debit: 0, credit: cashDifference },
              ],
            });
          }
        }
      } else {
        // ── DIRECT mode: only handle cash difference ────────────────────
        if (Math.abs(cashDifference) >= 0.01) {
          const cashShortOverAccount = await getSystemAccount(tx, organizationId, "6150");
          const cashBankInfo = await getDefaultCashBankAccount(
            tx,
            organizationId,
            "CASH",
            posSession.branchId,
            registerConfig?.defaultCashAccountId
          );

          if (cashShortOverAccount && cashBankInfo) {
            if (cashDifference < 0) {
              // Shortage: DR Cash Short & Over, CR Cash
              await createAutoJournalEntry(tx, organizationId, {
                date: now,
                description: `POS Cash Shortage (${posSession.sessionNumber})`,
                sourceType: "POS_SESSION_CLOSE",
                sourceId: id,
                branchId: posSession.branchId,
                lines: [
                  { accountId: cashShortOverAccount.id, description: "Cash Short and Over", debit: Math.abs(cashDifference), credit: 0 },
                  { accountId: cashBankInfo.accountId, description: "Cash", debit: 0, credit: Math.abs(cashDifference) },
                ],
              });
            } else {
              // Overage: DR Cash, CR Cash Short & Over
              await createAutoJournalEntry(tx, organizationId, {
                date: now,
                description: `POS Cash Overage (${posSession.sessionNumber})`,
                sourceType: "POS_SESSION_CLOSE",
                sourceId: id,
                branchId: posSession.branchId,
                lines: [
                  { accountId: cashBankInfo.accountId, description: "Cash", debit: cashDifference, credit: 0 },
                  { accountId: cashShortOverAccount.id, description: "Cash Short and Over", debit: 0, credit: cashDifference },
                ],
              });
            }

            // Update CashBankAccount balance for the difference
            await tx.cashBankAccount.update({
              where: { id: cashBankInfo.cashBankAccountId },
              data: { balance: { increment: cashDifference } },
            });
            const updatedCB = await tx.cashBankAccount.findUnique({
              where: { id: cashBankInfo.cashBankAccountId },
            });
            await tx.cashBankTransaction.create({
              data: {
                cashBankAccountId: cashBankInfo.cashBankAccountId,
                transactionType: "ADJUSTMENT",
                amount: cashDifference,
                runningBalance: Number(updatedCB?.balance || 0),
                description: `POS Cash ${cashDifference < 0 ? "Shortage" : "Overage"} (${posSession.sessionNumber})`,
                referenceType: "POS_SESSION",
                referenceId: id,
                transactionDate: now,
                organizationId,
              },
            });
          }
        }
      }

      // ── Update session ──────────────────────────────────────────────────
      const updatedSession = await tx.pOSSession.update({
        where: { id, organizationId },
        data: {
          status: "CLOSED",
          closedAt: now,
          closingCash,
          expectedCash,
          cashDifference,
          totalSales,
          totalTransactions,
          notes: notes || posSession.notes,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return updatedSession;
    }, { timeout: 30000 });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to close POS session:", error);
    return NextResponse.json(
      { error: "Failed to close POS session" },
      { status: 500 }
    );
  }
}
