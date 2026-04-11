import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { parsePagination, paginatedResponse } from "@/lib/pagination";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const compact = new URL(request.url).searchParams.get("compact") === "true";

    if (compact) {
      const suppliers = await prisma.supplier.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          balance: true,
          vatNumber: true,
        },
      });

      return NextResponse.json(suppliers);
    }

    const { limit, offset, search } = parsePagination(request);
    const baseWhere = { organizationId };
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

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          _count: {
            select: { purchaseInvoices: true },
          },
        },
      }),
      prisma.supplier.count({ where }),
    ]);

    return paginatedResponse(suppliers, total, offset + suppliers.length < total);
  } catch (error) {
    console.error("Failed to fetch suppliers:", error);
    return NextResponse.json(
      { error: "Failed to fetch suppliers" },
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
    const { name, email, phone, address, city, state, zipCode, country, notes, gstin, gstStateCode, vatNumber, arabicName, ccNo, buildingNo, addNo, district } = body;

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

    const supplier = await prisma.supplier.create({
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
        vatNumber: vatNumber || null,
        arabicName: arabicName || null,
        ccNo: ccNo || null,
        buildingNo: buildingNo || null,
        addNo: addNo || null,
        district: district || null,
      },
    });

    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    console.error("Failed to create supplier:", error);
    return NextResponse.json(
      { error: "Failed to create supplier" },
      { status: 500 }
    );
  }
}
