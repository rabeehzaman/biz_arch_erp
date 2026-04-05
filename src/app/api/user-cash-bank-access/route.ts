import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await prisma.userCashBankAccess.findMany({
      where: { organizationId: session.user.organizationId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        cashBankAccount: {
          select: {
            id: true,
            name: true,
            accountSubType: true,
            bankName: true,
            accountNumber: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(access);
  } catch (error) {
    console.error("Failed to fetch user cash/bank access:", error);
    return NextResponse.json(
      { error: "Failed to fetch user cash/bank access" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["admin", "superadmin"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, cashBankAccountId, isDefault } = body;

    if (!userId || !cashBankAccountId) {
      return NextResponse.json(
        { error: "userId and cashBankAccountId are required" },
        { status: 400 }
      );
    }

    const organizationId = session.user.organizationId;

    // Verify account belongs to org
    const account = await prisma.cashBankAccount.findFirst({
      where: { id: cashBankAccountId, organizationId },
      select: { id: true },
    });
    if (!account) {
      return NextResponse.json(
        { error: "Cash/bank account not found" },
        { status: 404 }
      );
    }

    // Verify user belongs to org
    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId },
    });
    if (!user) {
      return NextResponse.json(
        { error: "User not found in this organization" },
        { status: 404 }
      );
    }

    // If setting as default, unset existing default for this user
    if (isDefault) {
      await prisma.userCashBankAccess.updateMany({
        where: { userId, organizationId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const access = await prisma.userCashBankAccess.upsert({
      where: {
        userId_cashBankAccountId: { userId, cashBankAccountId },
      },
      create: {
        userId,
        cashBankAccountId,
        isDefault: isDefault || false,
        organizationId,
      },
      update: {
        isDefault: isDefault || false,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        cashBankAccount: {
          select: {
            id: true,
            name: true,
            accountSubType: true,
            bankName: true,
            accountNumber: true,
          },
        },
      },
    });

    return NextResponse.json(access, { status: 201 });
  } catch (error) {
    console.error("Failed to create user cash/bank access:", error);
    return NextResponse.json(
      { error: "Failed to create user cash/bank access" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["admin", "superadmin"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Access ID is required" },
        { status: 400 }
      );
    }

    const access = await prisma.userCashBankAccess.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });

    if (!access) {
      return NextResponse.json(
        { error: "Access not found" },
        { status: 404 }
      );
    }

    await prisma.userCashBankAccess.delete({ where: { id } });

    return NextResponse.json({ message: "Access removed" });
  } catch (error) {
    console.error("Failed to delete user cash/bank access:", error);
    return NextResponse.json(
      { error: "Failed to delete user cash/bank access" },
      { status: 500 }
    );
  }
}
