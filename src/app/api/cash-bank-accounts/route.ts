import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import {
  getUserAllowedCashBankAccountIds,
  buildCashBankAccessWhereClause,
  getUserAllowedBranchIds,
  buildBranchWhereClause,
} from "@/lib/user-access";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const userId = session.user.id!;
    const role = (session.user as any).role || "user";
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("activeOnly") === "true";

    const [allowedAccountIds, allowedBranchIds] = await Promise.all([
      getUserAllowedCashBankAccountIds(prisma, organizationId, userId, role),
      getUserAllowedBranchIds(prisma, organizationId, userId, role),
    ]);

    // If user has no access in an opt-in org, return empty
    if (
      (allowedAccountIds !== null && allowedAccountIds.length === 0) ||
      (allowedBranchIds !== null && allowedBranchIds.length === 0)
    ) {
      return NextResponse.json([]);
    }

    const accountFilter = buildCashBankAccessWhereClause(allowedAccountIds);
    const branchFilter = buildBranchWhereClause(allowedBranchIds, {
      includeNullBranch: true,
    });

    const accounts = await prisma.cashBankAccount.findMany({
      where: {
        organizationId,
        ...(activeOnly ? { isActive: true } : {}),
        ...accountFilter,
        ...branchFilter,
      },
      orderBy: { createdAt: "asc" },
      include: {
        account: { select: { id: true, code: true, name: true } },
        _count: { select: { transactions: true } },
      },
    });

    return NextResponse.json(accounts);
  } catch (error) {
    console.error("Failed to fetch cash/bank accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch cash/bank accounts" },
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
    const body = await request.json();
    const { name, accountId, accountSubType, bankName, accountNumber, openingBalance } = body;

    if (!name || !accountId || !accountSubType) {
      return NextResponse.json(
        { error: "Name, account, and account sub type are required" },
        { status: 400 }
      );
    }

    if (!["BANK", "CASH"].includes(accountSubType)) {
      return NextResponse.json(
        { error: "Account sub type must be BANK or CASH" },
        { status: 400 }
      );
    }

    const balance = parseFloat(openingBalance) || 0;

    const result = await prisma.$transaction(async (tx) => {
      const cashBankAccount = await tx.cashBankAccount.create({
        data: {
          name,
          accountId,
          accountSubType,
          bankName: bankName || null,
          accountNumber: accountNumber || null,
          balance,
          organizationId,
        },
        include: {
          account: { select: { id: true, code: true, name: true } },
        },
      });

      // Create opening balance transaction if there's an opening balance
      if (balance !== 0) {
        await tx.cashBankTransaction.create({
          data: {
            cashBankAccountId: cashBankAccount.id,
            transactionType: "OPENING_BALANCE",
            amount: balance,
            runningBalance: balance,
            description: "Opening Balance",
            transactionDate: new Date(),
            organizationId,
            createdById: session.user.id,
          },
        });
      }

      return cashBankAccount;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    console.error("Failed to create cash/bank account:", error);
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "An account with this name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create cash/bank account" },
      { status: 500 }
    );
  }
}
