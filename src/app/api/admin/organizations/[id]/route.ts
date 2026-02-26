import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { seedDefaultCOA } from "@/lib/accounting/seed-coa";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        users: {
          select: { id: true, name: true, email: true, role: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: { users: true, customers: true, suppliers: true, invoices: true, products: true },
        },
      },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json(organization);
  } catch (error) {
    console.error("Failed to fetch organization:", error);
    return NextResponse.json(
      { error: "Failed to fetch organization" },
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

    if (session.user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, slug, gstEnabled, eInvoicingEnabled, multiUnitEnabled, gstin, gstStateCode } = body;

    // Basic field update validation
    if (slug && !/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: "Slug must contain only lowercase letters, numbers, and hyphens" },
        { status: 400 }
      );
    }

    // Check slug uniqueness if changing
    if (slug) {
      const existing = await prisma.organization.findFirst({
        where: { slug, id: { not: id } },
      });
      if (existing) {
        return NextResponse.json(
          { error: "An organization with this slug already exists" },
          { status: 409 }
        );
      }
    }

    // GST validation
    if (gstEnabled && gstin) {
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(gstin)) {
        return NextResponse.json(
          { error: "Invalid GSTIN format" },
          { status: 400 }
        );
      }
    }

    if (eInvoicingEnabled && !gstEnabled) {
      return NextResponse.json(
        { error: "GST must be enabled before enabling e-invoicing" },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (gstEnabled !== undefined) updateData.gstEnabled = gstEnabled;
    if (eInvoicingEnabled !== undefined) updateData.eInvoicingEnabled = gstEnabled ? eInvoicingEnabled : false;
    if (multiUnitEnabled !== undefined) updateData.multiUnitEnabled = multiUnitEnabled;
    if (gstin !== undefined) updateData.gstin = gstin || null;
    if (gstStateCode !== undefined) updateData.gstStateCode = gstStateCode || null;

    // Auto-derive state code from GSTIN
    if (gstin && gstin.length >= 2 && gstEnabled) {
      updateData.gstStateCode = gstin.substring(0, 2);
    }

    const organization = await prisma.$transaction(
      async (tx) => {
        const org = await tx.organization.update({
          where: { id },
          data: updateData,
        });

        // Seed GST accounts if enabling GST
        if (gstEnabled) {
          await seedDefaultCOA(tx as never, id);
        }

        return org;
      },
      {
        timeout: 30000, // Increase timeout to 30s to allow multiple upserts on poor network/Neon
      }
    );

    return NextResponse.json(organization);
  } catch (error) {
    console.error("Failed to update organization:", error);
    return NextResponse.json(
      { error: "Failed to update organization" },
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

    if (session.user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Check if org has any data
    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true, invoices: true, customers: true },
        },
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (org._count.invoices > 0 || org._count.customers > 0) {
      return NextResponse.json(
        { error: "Cannot delete organization with existing data. Remove all customers and invoices first." },
        { status: 400 }
      );
    }

    // Delete users first, then org
    await prisma.user.deleteMany({ where: { organizationId: id } });
    await prisma.setting.deleteMany({ where: { organizationId: id } });
    await prisma.unit.deleteMany({ where: { organizationId: id } });
    await prisma.organization.delete({ where: { id } });

    return NextResponse.json({ message: "Organization deleted" });
  } catch (error) {
    console.error("Failed to delete organization:", error);
    return NextResponse.json(
      { error: "Failed to delete organization" },
      { status: 500 }
    );
  }
}
