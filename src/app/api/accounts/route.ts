import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);

    const accounts = await prisma.account.findMany({
      where: { organizationId },
      orderBy: { code: "asc" },
      include: {
        parent: { select: { id: true, code: true, name: true } },
        _count: { select: { children: true, journalEntryLines: true } },
      },
    });

    return NextResponse.json(accounts);
  } catch (error) {
    console.error("Failed to fetch accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
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
    const { code, name, accountType, accountSubType, description, parentId } = body;

    if (!code || !name || !accountType || !accountSubType) {
      return NextResponse.json(
        { error: "Code, name, account type, and sub type are required" },
        { status: 400 }
      );
    }

    // Validate parent account belongs to same org and has same accountType
    if (parentId) {
      const parentAccount = await prisma.account.findFirst({
        where: { id: parentId, organizationId },
      });
      if (!parentAccount) {
        return NextResponse.json(
          { error: "Parent account not found in this organization" },
          { status: 400 }
        );
      }
      if (parentAccount.accountType !== accountType) {
        return NextResponse.json(
          { error: `Parent account type (${parentAccount.accountType}) must match child account type (${accountType})` },
          { status: 400 }
        );
      }
    }

    const account = await prisma.account.create({
      data: {
        code,
        name,
        accountType,
        accountSubType,
        description: description || null,
        parentId: parentId || null,
        organizationId,
      },
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error: unknown) {
    console.error("Failed to create account:", error);
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "An account with this code already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
