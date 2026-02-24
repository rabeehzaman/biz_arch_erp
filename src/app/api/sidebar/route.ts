import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json([]);
        }

        let organizationId: string;
        try {
            organizationId = getOrgId(session);
        } catch {
            return NextResponse.json([]);
        }

        const setting = await prisma.setting.findFirst({
            where: {
                organizationId,
                key: "disabledSidebarItems",
            },
        });

        let disabledSidebarItems: string[] = [];
        if (setting && setting.value) {
            try {
                disabledSidebarItems = JSON.parse(setting.value);
            } catch (e) {
                // ignore
            }
        }

        return NextResponse.json(disabledSidebarItems);
    } catch (error) {
        console.error("Failed to fetch sidebar settings:", error);
        // Return empty array rather than error to avoid breaking the UI hook
        return NextResponse.json([]);
    }
}
