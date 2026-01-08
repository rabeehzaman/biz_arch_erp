import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const suppliers = await prisma.supplier.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        balance: true,
        isActive: true,
        _count: {
          select: {
            purchaseInvoices: true,
          },
        },
      },
      orderBy: {
        balance: "desc",
      },
    });

    const formattedSuppliers = suppliers.map((supplier) => ({
      id: supplier.id,
      name: supplier.name,
      email: supplier.email,
      phone: supplier.phone,
      balance: Number(supplier.balance),
      invoiceCount: supplier._count.purchaseInvoices,
      isActive: supplier.isActive,
    }));

    const summary = {
      totalSuppliers: suppliers.length,
      activeSuppliers: suppliers.filter((s) => s.isActive).length,
      totalPayable: formattedSuppliers.reduce((sum, s) => sum + s.balance, 0),
      suppliersWithBalance: formattedSuppliers.filter((s) => s.balance > 0).length,
    };

    return NextResponse.json({
      suppliers: formattedSuppliers,
      summary,
    });
  } catch (error) {
    console.error("Error fetching supplier balances:", error);
    return NextResponse.json(
      { error: "Failed to fetch supplier balances" },
      { status: 500 }
    );
  }
}
