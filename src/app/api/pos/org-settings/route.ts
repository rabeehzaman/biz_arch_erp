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

        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { posAccountingMode: true },
        });

        return NextResponse.json({
            posAccountingMode: org?.posAccountingMode || "DIRECT",
        });
    } catch (error) {
        console.error("Failed to fetch POS org settings:", error);
        return NextResponse.json(
            { error: "Failed to fetch settings" },
            { status: 500 }
        );
    }
}
