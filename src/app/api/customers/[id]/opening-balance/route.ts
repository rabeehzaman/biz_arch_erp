import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

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
    const { amount, transactionDate, description } = body;

    if (amount === undefined || amount === null) {
      return NextResponse.json(
        { error: "Amount is required" },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.findUnique({
      where: { id, organizationId },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Check if opening balance already exists
    const existingOpeningBalance = await prisma.customerTransaction.findFirst({
      where: {
        customerId: id,
        transactionType: "OPENING_BALANCE",
        organizationId,
      },
    });

    const parsedAmount = parseFloat(amount);
    const date = transactionDate ? new Date(transactionDate) : new Date();

    await prisma.$transaction(async (tx) => {
      if (existingOpeningBalance) {
        // Update existing opening balance
        const amountDifference = parsedAmount - Number(existingOpeningBalance.amount);

        await tx.customerTransaction.update({
          where: { id: existingOpeningBalance.id },
          data: {
            amount: parsedAmount,
            transactionDate: date,
            description: description || "Opening Balance",
            runningBalance: parsedAmount,
          },
        });

        // Update customer balance
        await tx.customer.update({
          where: { id },
          data: {
            balance: { increment: amountDifference },
          },
        });

        // Recalculate running balances for all subsequent transactions
        const transactions = await tx.customerTransaction.findMany({
          where: {
            customerId: id,
            transactionDate: { gt: date },
            organizationId,
          },
          orderBy: { transactionDate: "asc" },
        });

        let runningBalance = parsedAmount;
        for (const txn of transactions) {
          runningBalance = runningBalance + Number(txn.amount);
          await tx.customerTransaction.update({
            where: { id: txn.id },
            data: { runningBalance },
          });
        }
      } else {
        // Create new opening balance transaction
        await tx.customerTransaction.create({
          data: {
            customerId: id,
            transactionType: "OPENING_BALANCE",
            transactionDate: date,
            amount: parsedAmount,
            description: description || "Opening Balance",
            runningBalance: parsedAmount,
            organizationId,
          },
        });

        // Update customer balance
        await tx.customer.update({
          where: { id },
          data: {
            balance: { increment: parsedAmount },
          },
        });
      }
    });

    const updatedCustomer = await prisma.customer.findUnique({
      where: { id, organizationId },
    });

    return NextResponse.json({
      success: true,
      customer: updatedCustomer,
    });
  } catch (error) {
    console.error("Failed to set opening balance:", error);
    return NextResponse.json(
      { error: "Failed to set opening balance" },
      { status: 500 }
    );
  }
}

export async function GET(
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

    const openingBalance = await prisma.customerTransaction.findFirst({
      where: {
        customerId: id,
        transactionType: "OPENING_BALANCE",
        organizationId,
      },
    });

    return NextResponse.json(openingBalance);
  } catch (error) {
    console.error("Failed to fetch opening balance:", error);
    return NextResponse.json(
      { error: "Failed to fetch opening balance" },
      { status: 500 }
    );
  }
}
