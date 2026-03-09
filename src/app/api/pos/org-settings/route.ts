import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { getOrganizationRoundOffMode } from "@/lib/round-off";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const organizationId = getOrgId(session);

        const [org, roundOffMode] = await Promise.all([
            prisma.organization.findUnique({
                where: { id: organizationId },
                select: { posAccountingMode: true, saudiEInvoiceEnabled: true },
            }),
            getOrganizationRoundOffMode(prisma, organizationId),
        ]);

        return NextResponse.json({
            posAccountingMode: org?.posAccountingMode || "DIRECT",
            saudiEInvoiceEnabled: org?.saudiEInvoiceEnabled || false,
            roundOffMode,
        });
    } catch (error) {
        console.error("Failed to fetch POS org settings:", error);
        return NextResponse.json(
            { error: "Failed to fetch settings" },
            { status: 500 }
        );
    }
}
