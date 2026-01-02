import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Generate supplier payment number: SPAY-YYYYMMDD-XXX
async function generateSupplierPaymentNumber() {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `SPAY-${dateStr}`;

  const lastPayment = await prisma.supplierPayment.findFirst({
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
    const payments = await prisma.supplierPayment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        supplier: {
          select: { id: true, name: true },
        },
        purchaseInvoice: {
          select: { id: true, purchaseInvoiceNumber: true },
        },
      },
    });
    return NextResponse.json(payments);
  } catch (error) {
    console.error("Failed to fetch supplier payments:", error);
    return NextResponse.json(
      { error: "Failed to fetch supplier payments" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { supplierId, purchaseInvoiceId, amount, paymentDate, paymentMethod, reference, notes } = body;

    if (!supplierId || !amount) {
      return NextResponse.json(
        { error: "Supplier and amount are required" },
        { status: 400 }
      );
    }

    const paymentNumber = await generateSupplierPaymentNumber();

    const payment = await prisma.supplierPayment.create({
      data: {
        paymentNumber,
        supplierId,
        purchaseInvoiceId: purchaseInvoiceId || null,
        amount,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        paymentMethod: paymentMethod || "CASH",
        reference: reference || null,
        notes: notes || null,
      },
    });

    // Update supplier balance (decrease payable)
    await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        balance: { decrement: amount },
      },
    });

    // Update purchase invoice if linked
    if (purchaseInvoiceId) {
      const invoice = await prisma.purchaseInvoice.findUnique({
        where: { id: purchaseInvoiceId },
        select: { total: true, amountPaid: true },
      });

      if (invoice) {
        const newAmountPaid = Number(invoice.amountPaid) + amount;
        const newBalanceDue = Number(invoice.total) - newAmountPaid;
        const newStatus = newBalanceDue <= 0 ? "PAID" : "PARTIALLY_PAID";

        await prisma.purchaseInvoice.update({
          where: { id: purchaseInvoiceId },
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
    console.error("Failed to create supplier payment:", error);
    return NextResponse.json(
      { error: "Failed to create supplier payment" },
      { status: 500 }
    );
  }
}
