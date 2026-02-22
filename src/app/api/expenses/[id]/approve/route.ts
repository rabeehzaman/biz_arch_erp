import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;

    const expense = await prisma.expense.findFirst({
      where: { id, organizationId },
    });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    if (expense.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft expenses can be approved" },
        { status: 400 }
      );
    }

    const updated = await prisma.expense.update({
      where: { id, organizationId },
      data: { status: "APPROVED" },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to approve expense:", error);
    return NextResponse.json(
      { error: "Failed to approve expense" },
      { status: 500 }
    );
  }
}
