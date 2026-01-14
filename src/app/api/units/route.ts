import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const units = await prisma.unit.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
    return NextResponse.json(units);
  } catch (error) {
    console.error("Failed to fetch units:", error);
    return NextResponse.json(
      { error: "Failed to fetch units" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, name } = body;

    if (!code || !name) {
      return NextResponse.json(
        { error: "Code and name are required" },
        { status: 400 }
      );
    }

    // Check if unit code already exists
    const existing = await prisma.unit.findUnique({
      where: { code: code.toLowerCase() },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Unit code already exists" },
        { status: 409 }
      );
    }

    const unit = await prisma.unit.create({
      data: {
        code: code.toLowerCase(),
        name,
      },
    });

    return NextResponse.json(unit, { status: 201 });
  } catch (error) {
    console.error("Failed to create unit:", error);
    return NextResponse.json(
      { error: "Failed to create unit" },
      { status: 500 }
    );
  }
}
