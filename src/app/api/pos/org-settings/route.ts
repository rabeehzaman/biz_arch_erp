import { NextRequest, NextResponse } from "next/server";
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
                select: { posAccountingMode: true, saudiEInvoiceEnabled: true, posDefaultCashAccountId: true, posDefaultBankAccountId: true, posEmployeePinRequired: true },
            }),
            getOrganizationRoundOffMode(prisma, organizationId),
        ]);

        return NextResponse.json({
            posAccountingMode: org?.posAccountingMode || "DIRECT",
            saudiEInvoiceEnabled: org?.saudiEInvoiceEnabled || false,
            posDefaultCashAccountId: org?.posDefaultCashAccountId || null,
            posDefaultBankAccountId: org?.posDefaultBankAccountId || null,
            posEmployeePinRequired: org?.posEmployeePinRequired ?? false,
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
        const { posDefaultCashAccountId, posDefaultBankAccountId } = body;

        // Validate cash account
        if (posDefaultCashAccountId) {
            const cashAcct = await prisma.cashBankAccount.findFirst({
                where: { id: posDefaultCashAccountId, organizationId, isActive: true, accountSubType: "CASH" },
                select: { id: true },
            });
            if (!cashAcct) {
                return NextResponse.json(
                    { error: "Selected cash account is invalid, inactive, or not a CASH account" },
                    { status: 400 }
                );
            }
        }

        // Validate bank account
        if (posDefaultBankAccountId) {
            const bankAcct = await prisma.cashBankAccount.findFirst({
                where: { id: posDefaultBankAccountId, organizationId, isActive: true, accountSubType: "BANK" },
                select: { id: true },
            });
            if (!bankAcct) {
                return NextResponse.json(
                    { error: "Selected bank account is invalid, inactive, or not a BANK account" },
                    { status: 400 }
                );
            }
        }

        await prisma.organization.update({
            where: { id: organizationId },
            data: {
                posDefaultCashAccountId: posDefaultCashAccountId || null,
                posDefaultBankAccountId: posDefaultBankAccountId || null,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to update POS org settings:", error);
        return NextResponse.json(
            { error: "Failed to update settings" },
            { status: 500 }
        );
    }
}
