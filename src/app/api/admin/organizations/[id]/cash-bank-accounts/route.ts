import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

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

    const accounts = await prisma.cashBankAccount.findMany({
      where: { organizationId: id, isActive: true },
      select: { id: true, name: true, accountSubType: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(accounts);
  } catch (error) {
    console.error("Failed to fetch cash/bank accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch cash/bank accounts" },
      { status: 500 }
    );
  }
}
