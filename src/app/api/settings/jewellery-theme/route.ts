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
            select: {
                jewelleryThemeEnabled: true,
                jewelleryThemePreset: true,
                jewelleryThemeColor: true,
            },
        });

        return NextResponse.json({
            jewelleryThemeEnabled: org?.jewelleryThemeEnabled ?? true,
            jewelleryThemePreset: org?.jewelleryThemePreset ?? "gold",
            jewelleryThemeColor: org?.jewelleryThemeColor ?? null,
        });
    } catch (error) {
        console.error("Failed to fetch jewellery theme settings:", error);
        return NextResponse.json(
            { error: "Failed to fetch settings" },
            { status: 500 }
        );
    }
}
