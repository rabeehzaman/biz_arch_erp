import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import {
  AutoJournalEntryCreationError,
  createRequiredAutoJournalEntry,
  getSystemAccount,
} from "@/lib/accounting/journal";
import { getPOSRegisterConfig } from "@/lib/pos/register-config";

 
type Tx = any;

// Generate session number inside a transaction: POS-YYYYMMDD-XXX
async function generateSessionNumber(organizationId: string, tx: Tx) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `POS-${dateStr}`;

  const lastSession = await tx.pOSSession.findFirst({
    where: { sessionNumber: { startsWith: prefix }, organizationId },
    orderBy: { sessionNumber: "desc" },
  });

  let sequence = 1;
  if (lastSession) {
    const lastSequence = parseInt(lastSession.sessionNumber.split("-").pop() || "0");
    sequence = lastSequence + 1;
  }

  return `${prefix}-${sequence.toString().padStart(3, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const branchIdParam = searchParams.get("branchId");
    const warehouseIdParam = searchParams.get("warehouseId");
    const limitParam = searchParams.get("limit");

     
    const where: any = { organizationId };
    if (status) {
      where.status = status;
    }
    if (branchIdParam !== null) {
      where.branchId = branchIdParam === "null" ? null : branchIdParam;
    }
    if (warehouseIdParam !== null) {
      where.warehouseId = warehouseIdParam === "null" ? null : warehouseIdParam;
    }

    const take = limitParam ? parseInt(limitParam) : 50;

    const sessions = await prisma.pOSSession.findMany({
      where,
      orderBy: { openedAt: "desc" },
      take,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        branch: {
          select: { id: true, name: true, code: true },
        },
        warehouse: {
          select: { id: true, name: true, code: true },
        },
        _count: {
          select: { invoices: true, heldOrders: true },
        },
      },
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Failed to fetch POS sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch POS sessions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const userId = session.user.id;
    if (!userId) {
      return NextResponse.json({ error: "User ID not found in session" }, { status: 401 });
    }

    const body = await request.json();
    const { openingCash = 0, branchId, warehouseId } = body;

    // Fetch org accounting mode before the transaction
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { posAccountingMode: true },
    });
    const isClearingMode = org?.posAccountingMode === "CLEARING_ACCOUNT";

    // Wrap in transaction to prevent race conditions (duplicate sessions/numbers)
    const posSession = await prisma.$transaction(async (tx) => {
      // Validate branch exists and belongs to org (if provided)
      if (branchId) {
        const branch = await tx.branch.findFirst({
          where: { id: branchId, organizationId },
        });
        if (!branch) {
          throw new Error("INVALID_BRANCH");
        }
      }

      // Validate warehouse exists and belongs to org (if provided)
      if (warehouseId) {
        const warehouse = await tx.warehouse.findFirst({
          where: { id: warehouseId, organizationId },
        });
        if (!warehouse) {
          throw new Error("INVALID_WAREHOUSE");
        }
      }

      // Check if there's already an open session for this branch+warehouse
      const existingOpen = await tx.pOSSession.findFirst({
        where: {
          organizationId,
          status: "OPEN",
          branchId: branchId || null,
          warehouseId: warehouseId || null,
        },
      });

      if (existingOpen) {
        throw new Error("ALREADY_OPEN");
      }

      const sessionNumber = await generateSessionNumber(organizationId, tx);

      const newSession = await tx.pOSSession.create({
        data: {
          organizationId,
          sessionNumber,
          userId,
          status: "OPEN",
          openingCash,
          branchId: branchId || null,
          warehouseId: warehouseId || null,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          branch: { select: { id: true, name: true, code: true } },
          warehouse: { select: { id: true, name: true, code: true } },
        },
      });

      // ── Float journal (clearing mode only) ──────────────────────────────
      // DR Clearing (Undeposited Funds) / CR Store Safe
      // This puts the opening float "in transit" through the clearing account
      // so closing the session zeroes it out cleanly.
      if (isClearingMode && Number(openingCash) > 0) {
        const clearingAccount = await getSystemAccount(tx, organizationId, "1150");
        const registerConfig = await getPOSRegisterConfig(tx, organizationId, branchId || null, warehouseId || null);
        if (!registerConfig?.defaultCashAccountId) {
          throw new AutoJournalEntryCreationError(
            "Set a default cash account for this POS register before opening with opening cash in clearing mode."
          );
        }
        if (!clearingAccount) {
          throw new AutoJournalEntryCreationError(
            "POS clearing account is missing. Re-save organization settings to provision POS clearing accounts."
          );
        }
        const storeSafe = registerConfig?.defaultCashAccountId
          ? await tx.cashBankAccount.findFirst({
              where: { id: registerConfig.defaultCashAccountId, organizationId, isActive: true },
              select: { id: true, accountId: true },
            })
          : null;

        if (!storeSafe) {
          throw new AutoJournalEntryCreationError(
            "The configured POS cash account is missing or inactive. Update the register cash account before opening."
          );
        }

        const now = new Date();
        await createRequiredAutoJournalEntry(
          tx,
          organizationId,
          {
            date: now,
            description: `POS Float Issued - ${sessionNumber}`,
            sourceType: "POS_SESSION_OPEN",
            sourceId: newSession.id,
            branchId: branchId || null,
            lines: [
              { accountId: clearingAccount.id, description: "POS Undeposited Funds", debit: Number(openingCash), credit: 0 },
              { accountId: storeSafe.accountId, description: "Store Safe", debit: 0, credit: Number(openingCash) },
            ],
          },
          "Failed to post the POS opening float journal entry."
        );

        await tx.cashBankAccount.update({
          where: { id: storeSafe.id },
          data: { balance: { decrement: Number(openingCash) } },
        });
        const updatedSafe = await tx.cashBankAccount.findUnique({ where: { id: storeSafe.id } });
        await tx.cashBankTransaction.create({
          data: {
            cashBankAccountId: storeSafe.id,
            transactionType: "WITHDRAWAL",
            amount: Number(openingCash),
            runningBalance: Number(updatedSafe?.balance ?? 0),
            description: `POS Float Issued - ${sessionNumber}`,
            referenceType: "POS_SESSION",
            referenceId: newSession.id,
            transactionDate: now,
            organizationId,
          },
        });
      }

      return newSession;
    }, { timeout: 20000 });

    return NextResponse.json(posSession, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_BRANCH") {
      return NextResponse.json(
        { error: "Invalid branch selected." },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === "INVALID_WAREHOUSE") {
      return NextResponse.json(
        { error: "Invalid warehouse selected." },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === "ALREADY_OPEN") {
      return NextResponse.json(
        { error: "There is already an open POS session for this register. Please close it first or continue selling." },
        { status: 400 }
      );
    }
    if (error instanceof AutoJournalEntryCreationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    console.error("Failed to create POS session:", error);
    return NextResponse.json(
      { error: "Failed to create POS session" },
      { status: 500 }
    );
  }
}
