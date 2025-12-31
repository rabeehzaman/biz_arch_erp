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
    const { customerId, invoiceId, amount, paymentDate, paymentMethod, reference, notes } = body;

    if (!customerId || !amount) {
      return NextResponse.json(
        { error: "Customer and amount are required" },
        { status: 400 }
      );
    }

    const paymentNumber = await generatePaymentNumber();

    const payment = await prisma.payment.create({
      data: {
        paymentNumber,
        customerId,
        invoiceId: invoiceId || null,
        amount,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        paymentMethod: paymentMethod || "CASH",
        reference: reference || null,
        notes: notes || null,
      },
    });

    // Update customer balance
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        balance: { decrement: amount },
      },
    });

    // Update invoice if linked
    if (invoiceId) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: { total: true, amountPaid: true },
      });

      if (invoice) {
        const newAmountPaid = Number(invoice.amountPaid) + amount;
        const newBalanceDue = Number(invoice.total) - newAmountPaid;
        const newStatus = newBalanceDue <= 0 ? "PAID" : "PARTIALLY_PAID";

        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            amountPaid: newAmountPaid,
            balanceDue: Math.max(0, newBalanceDue),
            status: newStatus,
          },
        });
      }
    }

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error("Failed to create payment:", error);
    return NextResponse.json(
      { error: "Failed to create payment" },
      { status: 500 }
    );
  }
}
