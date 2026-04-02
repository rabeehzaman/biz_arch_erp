import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { isAdminRole } from "@/lib/access-control";
import { parsePagination, paginatedResponse } from "@/lib/pagination";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const userId = session.user.id;
    const isAdmin = isAdminRole(session.user.role);
    const { searchParams } = new URL(request.url);
    const compact = searchParams.get("compact") === "true";

    const baseWhere = isAdmin
      ? { organizationId }
      : {
          organizationId,
          assignments: { some: { userId } },
        };

    if (compact) {
      const customers = await prisma.customer.findMany({
        where: baseWhere,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          balance: true,
        },
      });

      return NextResponse.json(customers);
    }

    const { limit, offset, search } = parsePagination(request);

    const where = search
      ? {
          ...baseWhere,
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search } },
          ],
        }
      : baseWhere;

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          _count: {
            select: { invoices: true },
          },
          assignments: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    return paginatedResponse(customers, total, offset + customers.length < total);
  } catch (error) {
    console.error("Failed to fetch customers:", error);
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const body = await request.json();
    const { name, email, phone, address, city, state, zipCode, country, notes, gstin, gstStateCode, ccNo, buildingNo, addNo, district, vatNumber, arabicName } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

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

    // Create customer and auto-assign to creator
    const customer = await prisma.customer.create({
      data: {
        organizationId,
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
        country: country || ((session.user as any).saudiEInvoiceEnabled ? "Saudi Arabia" : "India"),
        notes: notes || null,
        gstin: gstin || null,
        gstStateCode: gstStateCode || null,
        ccNo: ccNo || null,
        buildingNo: buildingNo || null,
        addNo: addNo || null,
        district: district || null,
        vatNumber: vatNumber || null,
        arabicName: arabicName || null,
        assignments: {
          create: {
            userId: session.user.id,
            organizationId,
          },
        },
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

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error("Failed to create customer:", error);
    return NextResponse.json(
      { error: "Failed to create customer" },
      { status: 500 }
    );
  }
}
