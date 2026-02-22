import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

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

    const payment = await prisma.supplierPayment.findUnique({
      where: { id, organizationId },
      include: {
        supplier: {
          select: { id: true, name: true },
        },
        purchaseInvoice: {
          select: { id: true, purchaseInvoiceNumber: true },
        },
      },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "Supplier payment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(payment);
  } catch (error) {
    console.error("Failed to fetch supplier payment:", error);
    return NextResponse.json(
      { error: "Failed to fetch supplier payment" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Fetch payment with allocations
    const payment = await prisma.supplierPayment.findUnique({
      where: { id, organizationId },
      include: {
        allocations: {
          include: {
            purchaseInvoice: {
              select: { id: true, total: true, amountPaid: true },
            },
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "Supplier payment not found" },
        { status: 404 }
      );
    }

    // Use transaction to reverse all effects
    await prisma.$transaction(async (tx) => {
      // Reverse supplier balance (increment by amount + discount since both were decremented)
      const totalSettlement = Number(payment.amount) + Number(payment.discountGiven);
      await tx.supplier.update({
        where: { id: payment.supplierId, organizationId },
        data: {
          balance: { increment: totalSettlement },
        },
      });

      // Reverse all invoice allocations using tracked amounts
      for (const allocation of payment.allocations) {
        const invoice = allocation.purchaseInvoice;
        const allocatedAmount = Number(allocation.amount);
        const newAmountPaid = Number(invoice.amountPaid) - allocatedAmount;
        const newBalanceDue = Number(invoice.total) - newAmountPaid;

        // Determine new status
        let newStatus: "RECEIVED" | "PARTIALLY_PAID" | "PAID" = "RECEIVED";
        if (newAmountPaid > 0 && newBalanceDue > 0) {
          newStatus = "PARTIALLY_PAID";
        } else if (newBalanceDue <= 0) {
          newStatus = "PAID";
        }

        await tx.purchaseInvoice.update({
          where: { id: allocation.purchaseInvoiceId, organizationId },
          data: {
            amountPaid: Math.max(0, newAmountPaid),
            balanceDue: newBalanceDue,
            status: newStatus,
          },
        });
      }

      // Delete related SupplierTransaction
      await tx.supplierTransaction.deleteMany({
        where: { supplierPaymentId: id, organizationId },
      });

      // Delete allocations and payment (allocations cascade delete)
      await tx.supplierPayment.delete({
        where: { id, organizationId },
      });
    });

    return NextResponse.json({ success: true, message: "Supplier payment deleted successfully" });
  } catch (error) {
    console.error("Failed to delete supplier payment:", error);
    return NextResponse.json(
      { error: "Failed to delete supplier payment" },
      { status: 500 }
    );
  }
}
