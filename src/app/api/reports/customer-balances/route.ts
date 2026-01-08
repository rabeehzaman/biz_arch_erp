import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        balance: true,
        isActive: true,
        _count: {
          select: {
            invoices: true,
          },
        },
      },
      orderBy: {
        balance: "desc",
      },
    });

    const formattedCustomers = customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      balance: Number(customer.balance),
      invoiceCount: customer._count.invoices,
      isActive: customer.isActive,
    }));

    const summary = {
      totalCustomers: customers.length,
      activeCustomers: customers.filter((c) => c.isActive).length,
      totalReceivable: formattedCustomers.reduce((sum, c) => sum + c.balance, 0),
      customersWithBalance: formattedCustomers.filter((c) => c.balance > 0).length,
    };

    return NextResponse.json({
      customers: formattedCustomers,
      summary,
    });
  } catch (error) {
    console.error("Error fetching customer balances:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer balances" },
      { status: 500 }
    );
  }
}
