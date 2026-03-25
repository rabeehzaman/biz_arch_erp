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

        const settings = await prisma.setting.findMany({
            where: {
                organizationId,
                key: { startsWith: "restaurant_" },
            },
        });

        const result: Record<string, string> = {};
        for (const s of settings) {
            result[s.key] = s.value;
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("Failed to fetch restaurant settings:", error);
        return NextResponse.json(
            { error: "Failed to fetch settings" },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (session.user.role !== "admin" && session.user.role !== "superadmin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const organizationId = getOrgId(session);
        const body = await request.json();
        const { key, value } = body;

        if (!key || typeof key !== "string" || !key.startsWith("restaurant_")) {
            return NextResponse.json(
                { error: "Invalid setting key" },
                { status: 400 }
            );
        }

        await prisma.setting.upsert({
            where: {
                organizationId_key: { organizationId, key },
            },
            update: { value: String(value) },
            create: { organizationId, key, value: String(value) },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to update restaurant setting:", error);
        return NextResponse.json(
            { error: "Failed to update setting" },
            { status: 500 }
        );
    }
}
