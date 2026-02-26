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
    const supplier = await prisma.supplier.findUnique({
      where: { id, organizationId },
      include: {
        purchaseInvoices: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(supplier);
  } catch (error) {
    console.error("Failed to fetch supplier:", error);
    return NextResponse.json(
      { error: "Failed to fetch supplier" },
      { status: 500 }
    );
  }
}

export async function PUT(
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
    const { name, email, phone, address, city, state, zipCode, country, notes, isActive, gstin, gstStateCode } = body;

    if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin)) {
      return NextResponse.json(
        { error: "Invalid GSTIN format. Expected format: 22AAAAA0000A1Z5" },
        { status: 400 }
      );
    }

    const supplier = await prisma.supplier.update({
      where: { id, organizationId },
      data: {
        name,
        email,
        phone,
        address,
        city,
        state,
        zipCode,
        country,
        notes,
        isActive,
        gstin: gstin !== undefined ? gstin : undefined,
        gstStateCode: gstStateCode !== undefined ? gstStateCode : undefined,
      },
    });

    return NextResponse.json(supplier);
  } catch (error) {
    console.error("Failed to update supplier:", error);
    return NextResponse.json(
      { error: "Failed to update supplier" },
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

    // Check if supplier has any purchase invoices
    const supplier = await prisma.supplier.findUnique({
      where: { id, organizationId },
      include: {
        _count: {
          select: { purchaseInvoices: true },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 }
      );
    }

    if (supplier._count.purchaseInvoices > 0) {
      return NextResponse.json(
        { error: "Cannot delete supplier with existing purchase invoices" },
        { status: 400 }
      );
    }

    await prisma.supplier.delete({
      where: { id, organizationId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete supplier:", error);
    return NextResponse.json(
      { error: "Failed to delete supplier" },
      { status: 500 }
    );
  }
}
