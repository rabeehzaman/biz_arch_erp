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
    const { supplierId, purchaseInvoiceId, amount, paymentDate, paymentMethod, reference, notes, discountGiven: rawDiscount } = body;
    const discountGiven = rawDiscount || 0;

    if (!supplierId || !amount) {
      return NextResponse.json(
        { error: "Supplier and amount are required" },
        { status: 400 }
      );
    }

    const paymentNumber = await generateSupplierPaymentNumber();
    const parsedPaymentDate = paymentDate ? new Date(paymentDate) : new Date();

    // Use transaction to ensure data consistency
    const payment = await prisma.$transaction(async (tx) => {
      // Create payment
      const newPayment = await tx.supplierPayment.create({
        data: {
          paymentNumber,
          supplierId,
          purchaseInvoiceId: purchaseInvoiceId || null,
          amount,
          discountGiven,
          paymentDate: parsedPaymentDate,
          paymentMethod: paymentMethod || "CASH",
          reference: reference || null,
          notes: notes || null,
        },
      });

      // Total settlement = cash paid + discount received from supplier
      const totalSettlement = Number(amount) + Number(discountGiven);

      // Update supplier balance (decrease payable by amount + discount)
      await tx.supplier.update({
        where: { id: supplierId },
        data: {
          balance: { decrement: totalSettlement },
        },
      });

      // Create SupplierTransaction record for payment
      await tx.supplierTransaction.create({
        data: {
          supplierId,
          transactionType: "PAYMENT",
          transactionDate: parsedPaymentDate,
          amount: -totalSettlement, // Negative = reduces what we owe (payment + discount)
          description: purchaseInvoiceId
            ? `Payment ${paymentNumber} for purchase invoice`
            : `Payment ${paymentNumber} (On Account)`,
          supplierPaymentId: newPayment.id,
          runningBalance: 0, // Will be recalculated if needed
        },
      });

      // Apply payment to purchase invoices
      if (purchaseInvoiceId) {
        // Specific invoice selected - apply to that invoice only
        const invoice = await tx.purchaseInvoice.findUnique({
          where: { id: purchaseInvoiceId },
          select: { id: true, total: true, amountPaid: true, balanceDue: true },
        });

        if (invoice) {
          const applyAmount = Math.min(totalSettlement, Number(invoice.balanceDue));
          const newAmountPaid = Number(invoice.amountPaid) + applyAmount;
          const newBalanceDue = Number(invoice.total) - newAmountPaid;
          const newStatus = newBalanceDue <= 0 ? "PAID" : "PARTIALLY_PAID";

          await tx.purchaseInvoice.update({
            where: { id: purchaseInvoiceId },
            data: {
              amountPaid: newAmountPaid,
              balanceDue: Math.max(0, newBalanceDue),
              status: newStatus,
            },
          });

          // Create allocation record
          await tx.supplierPaymentAllocation.create({
            data: {
              supplierPaymentId: newPayment.id,
              purchaseInvoiceId: purchaseInvoiceId,
              amount: applyAmount,
            },
          });
        }
      } else {
        // No specific invoice - FIFO auto-apply to unpaid purchase invoices
        const unpaidInvoices = await tx.purchaseInvoice.findMany({
          where: {
            supplierId,
            balanceDue: { gt: 0 },
          },
          orderBy: { invoiceDate: "asc" }, // Oldest first (FIFO)
          select: { id: true, total: true, amountPaid: true, balanceDue: true },
        });

        let remainingAmount = totalSettlement;

        for (const invoice of unpaidInvoices) {
          if (remainingAmount <= 0) break;

          const balanceDue = Number(invoice.balanceDue);
          const applyAmount = Math.min(remainingAmount, balanceDue);
          const newAmountPaid = Number(invoice.amountPaid) + applyAmount;
          const newBalanceDue = Number(invoice.total) - newAmountPaid;
          const newStatus = newBalanceDue <= 0 ? "PAID" : "PARTIALLY_PAID";

          // Update invoice
          await tx.purchaseInvoice.update({
            where: { id: invoice.id },
            data: {
              amountPaid: newAmountPaid,
              balanceDue: Math.max(0, newBalanceDue),
              status: newStatus,
            },
          });

          // Create allocation record
          await tx.supplierPaymentAllocation.create({
            data: {
              supplierPaymentId: newPayment.id,
              purchaseInvoiceId: invoice.id,
              amount: applyAmount,
            },
          });

          remainingAmount -= applyAmount;
        }
        // Any remaining amount just reduces supplier balance (already done above)
      }

      return newPayment;
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error("Failed to create supplier payment:", error);
    return NextResponse.json(
      { error: "Failed to create supplier payment" },
      { status: 500 }
    );
  }
}
