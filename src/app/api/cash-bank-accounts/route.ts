import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);

    const accounts = await prisma.cashBankAccount.findMany({
      where: { organizationId },
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
