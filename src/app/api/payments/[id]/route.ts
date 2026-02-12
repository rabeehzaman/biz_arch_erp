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

    const payment = await prisma.payment.findUnique({
      where: { id, organizationId },
      include: {
        customer: {
          select: { id: true, name: true },
        },
        invoice: {
          select: { id: true, invoiceNumber: true },
        },
      },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(payment);
  } catch (error) {
    console.error("Failed to fetch payment:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment" },
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
    const payment = await prisma.payment.findUnique({
      where: { id, organizationId },
      include: {
        allocations: {
          include: {
            invoice: {
              select: { id: true, total: true, amountPaid: true },
            },
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    // Use transaction to reverse all effects
    await prisma.$transaction(async (tx) => {
      // Reverse customer balance (increment by amount + discount since both were decremented)
      const totalSettlement = Number(payment.amount) + Number(payment.discountReceived);
      await tx.customer.update({
        where: { id: payment.customerId, organizationId },
        data: {
          balance: { increment: totalSettlement },
        },
      });

      // Reverse all invoice allocations using tracked amounts
      for (const allocation of payment.allocations) {
        const invoice = allocation.invoice;
        const allocatedAmount = Number(allocation.amount);

        await tx.invoice.update({
          where: { id: allocation.invoiceId, organizationId },
          data: {
            amountPaid: { decrement: allocatedAmount },
            balanceDue: { increment: allocatedAmount },
          },
        });
      }

      // Delete related CustomerTransaction
      await tx.customerTransaction.deleteMany({
        where: { paymentId: id, organizationId },
      });

      // Delete allocations and payment (allocations cascade delete)
      await tx.payment.delete({
        where: { id, organizationId },
      });
    });

    return NextResponse.json({ success: true, message: "Payment deleted successfully" });
  } catch (error) {
    console.error("Failed to delete payment:", error);
    return NextResponse.json(
      { error: "Failed to delete payment" },
      { status: 500 }
    );
  }
}
