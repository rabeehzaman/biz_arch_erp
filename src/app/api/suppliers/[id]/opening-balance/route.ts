import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { amount, transactionDate, description } = body;

    if (amount === undefined || amount === null) {
      return NextResponse.json(
        { error: "Amount is required" },
        { status: 400 }
      );
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 }
      );
    }

    // Check if opening balance already exists
    const existingOpeningBalance = await prisma.supplierTransaction.findFirst({
      where: {
        supplierId: id,
        transactionType: "OPENING_BALANCE",
      },
    });

    const parsedAmount = parseFloat(amount);
    const date = transactionDate ? new Date(transactionDate) : new Date();

    await prisma.$transaction(async (tx) => {
      if (existingOpeningBalance) {
        // Update existing opening balance
        const amountDifference = parsedAmount - Number(existingOpeningBalance.amount);

        await tx.supplierTransaction.update({
          where: { id: existingOpeningBalance.id },
          data: {
            amount: parsedAmount,
            transactionDate: date,
            description: description || "Opening Balance",
            runningBalance: parsedAmount,
          },
        });

        // Update supplier balance
        await tx.supplier.update({
          where: { id },
          data: {
            balance: { increment: amountDifference },
          },
        });

        // Recalculate running balances for all subsequent transactions
        const transactions = await tx.supplierTransaction.findMany({
          where: {
            supplierId: id,
            transactionDate: { gt: date },
          },
          orderBy: { transactionDate: "asc" },
        });

        let runningBalance = parsedAmount;
        for (const txn of transactions) {
          runningBalance = runningBalance + Number(txn.amount);
          await tx.supplierTransaction.update({
            where: { id: txn.id },
            data: { runningBalance },
          });
        }
      } else {
        // Create new opening balance transaction
        await tx.supplierTransaction.create({
          data: {
            supplierId: id,
            transactionType: "OPENING_BALANCE",
            transactionDate: date,
            amount: parsedAmount,
            description: description || "Opening Balance",
            runningBalance: parsedAmount,
          },
        });

        // Update supplier balance
        await tx.supplier.update({
          where: { id },
          data: {
            balance: { increment: parsedAmount },
          },
        });
      }
    });

    const updatedSupplier = await prisma.supplier.findUnique({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      supplier: updatedSupplier,
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
    const { id } = await params;

    const openingBalance = await prisma.supplierTransaction.findFirst({
      where: {
        supplierId: id,
        transactionType: "OPENING_BALANCE",
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
