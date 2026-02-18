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

    // Check if COA already exists
    const existingCount = await prisma.account.count({
      where: { organizationId },
    });

    if (existingCount > 0) {
      return NextResponse.json(
        { error: "Chart of accounts already exists for this organization" },
        { status: 409 }
      );
    }

    await seedDefaultCOA(prisma as never, organizationId);

    return NextResponse.json({ success: true, message: "Chart of accounts seeded successfully" });
  } catch (error) {
    console.error("Failed to seed COA:", error);
    return NextResponse.json(
      { error: "Failed to seed chart of accounts" },
      { status: 500 }
    );
  }
}
