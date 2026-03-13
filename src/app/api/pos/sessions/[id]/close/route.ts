import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import {
  AutoJournalEntryCreationError,
  createRequiredAutoJournalEntry,
  getDefaultCashBankAccount,
  getSystemAccount,
  ensureCashShortOverAccount,
} from "@/lib/accounting/journal";
import { getPOSRegisterConfig } from "@/lib/pos/register-config";
import { roundCurrency } from "@/lib/round-off";

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

      const cashReceived = roundCurrency(Number(cashPayments._sum.amount || 0));
      const expectedCash = roundCurrency(Number(posSession.openingCash) + cashReceived);
      const cashDifference = roundCurrency(Number(closingCash) - expectedCash);

      // Aggregate non-cash payments
      const nonCashPayments = await tx.payment.aggregate({
        where: {
          organizationId,
          invoice: { posSessionId: id },
          paymentMethod: { not: "CASH" },
        },
        _sum: { amount: true },
      });
      const nonCashTotal = roundCurrency(Number(nonCashPayments._sum.amount || 0));

      // Aggregate totals from invoices in this session
      const invoiceAggregates = await tx.invoice.aggregate({
        where: { organizationId, posSessionId: id },
        _sum: { total: true },
        _count: { id: true },
      });

      const totalSales = roundCurrency(Number(invoiceAggregates._sum.total || 0));
      const totalTransactions = invoiceAggregates._count.id;
      const now = new Date();

      // ── Settlement logic ──────────────────────────────────────────────
      if (isClearingMode) {
        const clearingAccount = await getSystemAccount(tx, organizationId, "1150");
        const cashShortOverAccount = await ensureCashShortOverAccount(tx, organizationId);

        // Detect whether this session had its float journaled at open
        // (i.e., the new Store Safe flow). This determines whether we deposit
        // the full closingCash or only the net (closingCash - openingCash).
        const floatJournaledAtOpen = await tx.journalEntry.findFirst({
          where: { sourceType: "POS_SESSION_OPEN", sourceId: id, organizationId },
          select: { id: true },
        });

        // Step A: Settle cash portion → Store Safe
        // New flow: DR Store Safe closingCash (+ DR Cash Short if shortage)
        //                          CR Clearing expectedCash
        // Old flow: DR Store Safe (closingCash - openingCash), CR Clearing same
        if (effectiveSettleCashAccountId && expectedCash > 0) {
          const cashCBA = await tx.cashBankAccount.findFirst({
            where: { id: effectiveSettleCashAccountId, organizationId, isActive: true },
            select: { id: true, accountId: true },
          });
          if (!clearingAccount) {
            throw new AutoJournalEntryCreationError(
              "POS clearing account is missing. Re-save organization settings to provision POS clearing accounts."
            );
          }
          if (!cashCBA) {
            throw new AutoJournalEntryCreationError(
              "The selected cash settlement account is missing or inactive."
            );
          }

          const depositAmount = roundCurrency(floatJournaledAtOpen
            ? Number(closingCash)                              // full deposit (new Store Safe flow)
            : Number(closingCash) - Number(posSession.openingCash)); // net deposit (legacy flow)
          const clearingCredit = roundCurrency(floatJournaledAtOpen
            ? expectedCash   // float + sales — matches what was debited to clearing at open + sales
            : depositAmount); // legacy: only sales proceeds credited back

          const lines: { accountId: string; description: string; debit: number; credit: number }[] = [];

          if (depositAmount > 0) {
            lines.push({ accountId: cashCBA.accountId, description: "Store Safe", debit: depositAmount, credit: 0 });
          }

          // Shortage or overage (only in new flow; legacy flow handled clearing separately)
          if (floatJournaledAtOpen && cashShortOverAccount) {
            if (cashDifference < -0.005) {
              lines.push({ accountId: cashShortOverAccount.id, description: "Cash Short and Over", debit: Math.abs(cashDifference), credit: 0 });
            } else if (cashDifference > 0.005) {
              lines.push({ accountId: cashShortOverAccount.id, description: "Cash Short and Over", debit: 0, credit: cashDifference });
            }
          }

          if (clearingCredit > 0) {
            lines.push({ accountId: clearingAccount.id, description: "POS Undeposited Funds", debit: 0, credit: clearingCredit });
          }

          if (lines.length < 2) {
            throw new AutoJournalEntryCreationError(
              "Failed to prepare the POS cash settlement journal entry."
            );
          }

          await createRequiredAutoJournalEntry(
            tx,
            organizationId,
            {
              date: now,
              description: `POS Session Close - Cash to Store Safe (${posSession.sessionNumber})`,
              sourceType: "POS_SESSION_CLOSE",
              sourceId: id,
              branchId: posSession.branchId,
              lines,
            },
            "Failed to post the POS cash settlement journal entry."
          );

          if (depositAmount > 0) {
            await tx.cashBankAccount.update({
              where: { id: cashCBA.id },
              data: { balance: { increment: depositAmount } },
            });
            const updatedCB = await tx.cashBankAccount.findUnique({ where: { id: cashCBA.id } });
            await tx.cashBankTransaction.create({
              data: {
                cashBankAccountId: cashCBA.id,
                transactionType: "DEPOSIT",
                amount: depositAmount,
                runningBalance: Number(updatedCB?.balance ?? 0),
                description: `POS Session Close - Cash to Store Safe (${posSession.sessionNumber})`,
                referenceType: "POS_SESSION",
                referenceId: id,
                transactionDate: now,
                organizationId,
              },
            });
          }
        }

        // Step B: Transfer non-cash payments from Clearing Account → Bank account
        if (nonCashTotal > 0 && effectiveSettleBankAccountId) {
          const bankCBA = await tx.cashBankAccount.findFirst({
            where: { id: effectiveSettleBankAccountId, organizationId, isActive: true },
            select: { id: true, accountId: true },
          });
          if (!clearingAccount) {
            throw new AutoJournalEntryCreationError(
              "POS clearing account is missing. Re-save organization settings to provision POS clearing accounts."
            );
          }
          if (!bankCBA) {
            throw new AutoJournalEntryCreationError(
              "The selected bank settlement account is missing or inactive."
            );
          }
          await createRequiredAutoJournalEntry(
            tx,
            organizationId,
            {
              date: now,
              description: `POS Session Close - Non-Cash Deposit (${posSession.sessionNumber})`,
              sourceType: "POS_SESSION_CLOSE",
              sourceId: id,
              branchId: posSession.branchId,
              lines: [
                { accountId: bankCBA.accountId, description: "Bank Account", debit: nonCashTotal, credit: 0 },
                { accountId: clearingAccount.id, description: "POS Undeposited Funds", debit: 0, credit: nonCashTotal },
              ],
            },
            "Failed to post the POS non-cash settlement journal entry."
          );

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
              runningBalance: Number(updatedBank?.balance ?? 0),
              description: `POS Session Close - Non-Cash Deposit (${posSession.sessionNumber})`,
              referenceType: "POS_SESSION",
              referenceId: id,
              transactionDate: now,
              organizationId,
            },
          });
        } else if (nonCashTotal > 0 && effectiveSettleCashAccountId && !effectiveSettleBankAccountId) {
          // Fallback: no separate bank account configured — deposit non-cash to Store Safe
          const fallbackCBA = await tx.cashBankAccount.findFirst({
            where: { id: effectiveSettleCashAccountId, organizationId, isActive: true },
            select: { id: true, accountId: true },
          });
          if (!clearingAccount) {
            throw new AutoJournalEntryCreationError(
              "POS clearing account is missing. Re-save organization settings to provision POS clearing accounts."
            );
          }
          if (!fallbackCBA) {
            throw new AutoJournalEntryCreationError(
              "The selected cash settlement account is missing or inactive."
            );
          }
          await createRequiredAutoJournalEntry(
            tx,
            organizationId,
            {
              date: now,
              description: `POS Session Close - Non-Cash Deposit (${posSession.sessionNumber})`,
              sourceType: "POS_SESSION_CLOSE",
              sourceId: id,
              branchId: posSession.branchId,
              lines: [
                { accountId: fallbackCBA.accountId, description: "Store Safe", debit: nonCashTotal, credit: 0 },
                { accountId: clearingAccount.id, description: "POS Undeposited Funds", debit: 0, credit: nonCashTotal },
              ],
            },
            "Failed to post the POS non-cash settlement journal entry."
          );

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
              runningBalance: Number(updatedFallback?.balance ?? 0),
              description: `POS Session Close - Non-Cash Deposit (${posSession.sessionNumber})`,
              referenceType: "POS_SESSION",
              referenceId: id,
              transactionDate: now,
              organizationId,
            },
          });
        }

        // Step C: Cash shortage/overage (legacy flow only — new flow embeds it in Step A)
        if (!floatJournaledAtOpen && Math.abs(cashDifference) >= 0.01 && clearingAccount && cashShortOverAccount) {
          if (cashDifference < 0) {
            await createRequiredAutoJournalEntry(
              tx,
              organizationId,
              {
                date: now,
                description: `POS Cash Shortage (${posSession.sessionNumber})`,
                sourceType: "POS_SESSION_CLOSE",
                sourceId: id,
                branchId: posSession.branchId,
                lines: [
                  { accountId: cashShortOverAccount.id, description: "Cash Short and Over", debit: Math.abs(cashDifference), credit: 0 },
                  { accountId: clearingAccount.id, description: "POS Undeposited Funds", debit: 0, credit: Math.abs(cashDifference) },
                ],
              },
              "Failed to post the POS cash shortage journal entry."
            );
          } else {
            await createRequiredAutoJournalEntry(
              tx,
              organizationId,
              {
                date: now,
                description: `POS Cash Overage (${posSession.sessionNumber})`,
                sourceType: "POS_SESSION_CLOSE",
                sourceId: id,
                branchId: posSession.branchId,
                lines: [
                  { accountId: clearingAccount.id, description: "POS Undeposited Funds", debit: cashDifference, credit: 0 },
                  { accountId: cashShortOverAccount.id, description: "Cash Short and Over", debit: 0, credit: cashDifference },
                ],
              },
              "Failed to post the POS cash overage journal entry."
            );
          }
        } else if (!floatJournaledAtOpen && Math.abs(cashDifference) >= 0.01) {
          throw new AutoJournalEntryCreationError(
            "POS cash difference account setup is incomplete for session close."
          );
        }
      } else {
        // ── DIRECT mode: only handle cash difference ────────────────────
        if (Math.abs(cashDifference) >= 0.01) {
          const cashShortOverAccount = await ensureCashShortOverAccount(tx, organizationId);
          const cashBankInfo = await getDefaultCashBankAccount(
            tx,
            organizationId,
            "CASH",
            posSession.branchId,
            registerConfig?.defaultCashAccountId
          );
          if (!cashShortOverAccount || !cashBankInfo) {
            throw new AutoJournalEntryCreationError(
              "POS cash difference account setup is incomplete for session close."
            );
          }

          if (cashDifference < 0) {
            // Shortage: DR Cash Short & Over, CR Cash
            await createRequiredAutoJournalEntry(
              tx,
              organizationId,
              {
                date: now,
                description: `POS Cash Shortage (${posSession.sessionNumber})`,
                sourceType: "POS_SESSION_CLOSE",
                sourceId: id,
                branchId: posSession.branchId,
                lines: [
                  { accountId: cashShortOverAccount.id, description: "Cash Short and Over", debit: Math.abs(cashDifference), credit: 0 },
                  { accountId: cashBankInfo.accountId, description: "Cash", debit: 0, credit: Math.abs(cashDifference) },
                ],
              },
              "Failed to post the POS cash shortage journal entry."
            );
          } else {
            // Overage: DR Cash, CR Cash Short & Over
            await createRequiredAutoJournalEntry(
              tx,
              organizationId,
              {
                date: now,
                description: `POS Cash Overage (${posSession.sessionNumber})`,
                sourceType: "POS_SESSION_CLOSE",
                sourceId: id,
                branchId: posSession.branchId,
                lines: [
                  { accountId: cashBankInfo.accountId, description: "Cash", debit: cashDifference, credit: 0 },
                  { accountId: cashShortOverAccount.id, description: "Cash Short and Over", debit: 0, credit: cashDifference },
                ],
              },
              "Failed to post the POS cash overage journal entry."
            );
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
    if (error instanceof AutoJournalEntryCreationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    console.error("Failed to close POS session:", error);
    return NextResponse.json(
      { error: "Failed to close POS session" },
      { status: 500 }
    );
  }
}
