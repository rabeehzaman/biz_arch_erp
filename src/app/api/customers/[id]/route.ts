import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { canAccessCustomer, isAdminRole } from "@/lib/access-control";

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
    const isAdmin = isAdminRole(session.user.role);

    if (!await canAccessCustomer(id, organizationId, session.user.id, isAdmin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id, organizationId },
      include: {
        invoices: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        assignments: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(customer);
  } catch (error) {
    console.error("Failed to fetch customer:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer" },
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
    const isAdmin = isAdminRole(session.user.role);

    if (!await canAccessCustomer(id, organizationId, session.user.id, isAdmin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, phone, address, city, state, zipCode, country, notes, isActive, gstin, gstStateCode, ccNo, buildingNo, addNo, district, vatNumber, arabicName } = body;

    if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin)) {
      return NextResponse.json(
        { error: "Invalid GSTIN format. Expected format: 22AAAAA0000A1Z5" },
        { status: 400 }
      );
    }

    if (vatNumber && !/^3\d{14}$/.test(vatNumber)) {
      return NextResponse.json(
        { error: "Invalid VAT Number. Must be 15 digits starting with 3." },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.update({
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
        ccNo: ccNo !== undefined ? ccNo : undefined,
        buildingNo: buildingNo !== undefined ? buildingNo : undefined,
        addNo: addNo !== undefined ? addNo : undefined,
        district: district !== undefined ? district : undefined,
        vatNumber: vatNumber !== undefined ? vatNumber : undefined,
        arabicName: arabicName !== undefined ? arabicName : undefined,
      },
      include: {
        assignments: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error("Failed to update customer:", error);
    return NextResponse.json(
      { error: "Failed to update customer" },
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
    const isAdmin = isAdminRole(session.user.role);

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check for linked records before deleting
    const invoiceCount = await prisma.invoice.count({ where: { customerId: id, organizationId } });
    if (invoiceCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete customer with ${invoiceCount} invoice(s). Delete or reassign invoices first.` },
        { status: 400 }
      );
    }

    await prisma.customer.delete({
      where: { id, organizationId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete customer:", error);
    return NextResponse.json(
      { error: "Failed to delete customer" },
      { status: 500 }
    );
  }
}
