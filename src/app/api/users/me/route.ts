import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// PATCH /api/users/me — update current user preferences (e.g. language)
export async function PATCH(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { language } = body;

        // Validate language
        const validLanguages = ["en", "ar"];
        if (language !== undefined && !validLanguages.includes(language)) {
            return NextResponse.json(
                { error: "Language must be 'en' or 'ar'" },
                { status: 400 }
            );
        }

        const updatedUser = await prisma.user.update({
            where: { id: session.user.id },
            data: {
                ...(language !== undefined && { language }),
            },
            select: {
                id: true,
                name: true,
                email: true,
                language: true,
            },
        });

        return NextResponse.json(updatedUser);
    } catch (error) {
        console.error("Failed to update user preferences:", error);
        return NextResponse.json(
            { error: "Failed to update user preferences" },
            { status: 500 }
        );
    }
}
