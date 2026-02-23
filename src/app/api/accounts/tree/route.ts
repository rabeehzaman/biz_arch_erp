import { NextResponse } from "next/server";
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
        _count: { select: { journalEntryLines: true } },
      },
    });

    // Calculate balance for each account
    const balanceResults = await Promise.all(
      accounts.map(async (account) => {
        const [debits, credits] = await Promise.all([
          prisma.journalEntryLine.aggregate({
            where: { accountId: account.id, organizationId },
            _sum: { debit: true },
          }),
          prisma.journalEntryLine.aggregate({
            where: { accountId: account.id, organizationId },
            _sum: { credit: true },
          }),
        ]);
        const balance = Number(debits._sum.debit ?? 0) - Number(credits._sum.credit ?? 0);
        return { accountId: account.id, balance };
      })
    );

    const balanceMap = new Map(balanceResults.map((r) => [r.accountId, r.balance]));

    // Build tree structure
    interface TreeNode {
      id: string;
      code: string;
      name: string;
      accountType: string;
      accountSubType: string;
      isSystem: boolean;
      isActive: boolean;
      parentId: string | null;
      transactionCount: number;
      balance: number;
      children: TreeNode[];
    }

    const nodeMap = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];

    for (const account of accounts) {
      nodeMap.set(account.id, {
        id: account.id,
        code: account.code,
        name: account.name,
        accountType: account.accountType,
        accountSubType: account.accountSubType,
        isSystem: account.isSystem,
        isActive: account.isActive,
        parentId: account.parentId,
        transactionCount: account._count.journalEntryLines,
        balance: balanceMap.get(account.id) ?? 0,
        children: [],
      });
    }

    for (const node of nodeMap.values()) {
      if (node.parentId && nodeMap.has(node.parentId)) {
        nodeMap.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return NextResponse.json(roots);
  } catch (error) {
    console.error("Failed to fetch account tree:", error);
    return NextResponse.json(
      { error: "Failed to fetch account tree" },
      { status: 500 }
    );
  }
}
