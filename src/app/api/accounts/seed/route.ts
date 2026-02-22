import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { seedDefaultCOA } from "@/lib/accounting/seed-coa";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);

    // seedDefaultCOA uses upserts, so it's safe to re-run
    // This will create missing accounts without affecting existing ones
    const existingCount = await prisma.account.count({
      where: { organizationId },
    });

    await seedDefaultCOA(prisma as never, organizationId);

    const newCount = await prisma.account.count({
      where: { organizationId },
    });

    const created = newCount - existingCount;
    const message = existingCount === 0
      ? "Chart of accounts seeded successfully"
      : created > 0
        ? `${created} missing account(s) restored`
        : "All default accounts already exist";

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error("Failed to seed COA:", error);
    return NextResponse.json(
      { error: "Failed to seed chart of accounts" },
      { status: 500 }
    );
  }
}
