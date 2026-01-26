import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Generate payment number: PAY-YYYYMMDD-XXX
async function generatePaymentNumber() {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `PAY-${dateStr}`;

  const lastPayment = await prisma.payment.findFirst({
    where: { paymentNumber: { startsWith: prefix } },
    orderBy: { paymentNumber: "desc" },
  });

  let sequence = 1;
  if (lastPayment) {
    const lastSequence = parseInt(lastPayment.paymentNumber.split("-").pop() || "0");
    sequence = lastSequence + 1;
  }

  return `${prefix}-${sequence.toString().padStart(3, "0")}`;
}

export async function GET() {
  try {
    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: { id: true, name: true },
        },
        invoice: {
          select: { id: true, invoiceNumber: true },
        },
      },
    });
    return NextResponse.json(payments);
  } catch (error) {
    console.error("Failed to fetch payments:", error);
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, invoiceId, amount, paymentDate, paymentMethod, reference, notes, discountReceived: rawDiscount } = body;
    const discountReceived = rawDiscount || 0;

    if (!customerId || !amount) {
      return NextResponse.json(
        { error: "Customer and amount are required" },
        { status: 400 }
      );
    }

    const paymentNumber = await generatePaymentNumber();
    const parsedPaymentDate = paymentDate ? new Date(paymentDate) : new Date();

    // Use transaction to ensure data consistency
    const payment = await prisma.$transaction(async (tx) => {
      // Create payment
      const newPayment = await tx.payment.create({
        data: {
          paymentNumber,
          customerId,
          invoiceId: invoiceId || null,
          amount,
          discountReceived,
          paymentDate: parsedPaymentDate,
          paymentMethod: paymentMethod || "CASH",
          reference: reference || null,
          notes: notes || null,
        },
      });

      // Total settlement = cash received + discount
      const totalSettlement = Number(amount) + Number(discountReceived);

      // Update customer balance (amount + discount settles the balance)
      await tx.customer.update({
        where: { id: customerId },
        data: {
          balance: { decrement: totalSettlement },
        },
      });

      // Apply payment to invoices
      if (invoiceId) {
        // Specific invoice selected - apply to that invoice only
        const invoice = await tx.invoice.findUnique({
          where: { id: invoiceId },
          select: { id: true, total: true, amountPaid: true, balanceDue: true },
        });

        if (invoice) {
          const applyAmount = Math.min(totalSettlement, Number(invoice.balanceDue));
          const newAmountPaid = Number(invoice.amountPaid) + applyAmount;
          const newBalanceDue = Number(invoice.total) - newAmountPaid;

          await tx.invoice.update({
            where: { id: invoiceId },
            data: {
              amountPaid: newAmountPaid,
              balanceDue: Math.max(0, newBalanceDue),
            },
          });

          // Create allocation record
          await tx.paymentAllocation.create({
            data: {
              paymentId: newPayment.id,
              invoiceId: invoiceId,
              amount: applyAmount,
            },
          });
        }
      } else {
        // No specific invoice - FIFO auto-apply to unpaid invoices
        const unpaidInvoices = await tx.invoice.findMany({
          where: {
            customerId,
            balanceDue: { gt: 0 },
          },
          orderBy: { issueDate: "asc" }, // Oldest first (FIFO)
          select: { id: true, total: true, amountPaid: true, balanceDue: true },
        });

        let remainingAmount = totalSettlement;

        for (const invoice of unpaidInvoices) {
          if (remainingAmount <= 0) break;

          const balanceDue = Number(invoice.balanceDue);
          const applyAmount = Math.min(remainingAmount, balanceDue);

          // Update invoice
          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              amountPaid: { increment: applyAmount },
              balanceDue: { decrement: applyAmount },
            },
          });

          // Create allocation record
          await tx.paymentAllocation.create({
            data: {
              paymentId: newPayment.id,
              invoiceId: invoice.id,
              amount: applyAmount,
            },
          });

          remainingAmount -= applyAmount;
        }
        // Any remaining amount just reduces customer balance (already done above)
      }

      // Create CustomerTransaction record for audit trail
      await tx.customerTransaction.create({
        data: {
          customerId,
          transactionType: "PAYMENT",
          transactionDate: parsedPaymentDate,
          amount: -totalSettlement, // Negative for credit (payment + discount reduces balance)
          description: invoiceId
            ? `Payment ${paymentNumber}`
            : `Payment ${paymentNumber} (Auto-Applied)`,
          paymentId: newPayment.id,
          runningBalance: 0, // Will be recalculated when viewing statement
        },
      });

      return newPayment;
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error("Failed to create payment:", error);
    return NextResponse.json(
      { error: "Failed to create payment" },
      { status: 500 }
    );
  }
}
