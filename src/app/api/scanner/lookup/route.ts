import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const organizationId = getOrgId(session);
        const { searchParams } = new URL(request.url);
        const code = searchParams.get("code");

        if (!code) {
            return NextResponse.json({ error: "Code is required" }, { status: 400 });
        }

        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { isMobileShopModuleEnabled: true },
        });

        // 1. Try to find a Product by barcode, sku, or weighMachineCode
        const product = await prisma.product.findFirst({
            where: {
                organizationId,
                OR: [
                    { barcode: code },
                    { sku: code },
                    { weighMachineCode: code },
                ],
            },
            include: {
                unit: true,
                stockLots: {
                    where: { remainingQuantity: { gt: 0 } },
                    select: { remainingQuantity: true },
                },
            },
        });

        if (product) {
            const availableStock = product.stockLots.reduce(
                (sum, lot) => sum + Number(lot.remainingQuantity),
                0
            );

            return NextResponse.json({
                type: "product",
                data: {
                    ...product,
                    availableStock,
                },
            });
        }

        // 2. Try to find a MobileDevice if module is enabled
        if (org?.isMobileShopModuleEnabled) {
            const device = await prisma.mobileDevice.findFirst({
                where: {
                    organizationId,
                    OR: [
                        { imei1: { contains: code, mode: "insensitive" } },
                        { imei2: { contains: code, mode: "insensitive" } },
                        { serialNumber: { contains: code, mode: "insensitive" } },
                    ],
                },
                include: {
                    product: {
                        select: { name: true },
                    },
                },
            });

            if (device) {
                return NextResponse.json({
                    type: "mobile_device",
                    data: device,
                });
            }
        }

        // 3. Not found
        return NextResponse.json({ type: "not_found", code }, { status: 404 });

    } catch (error) {
        console.error("Scanner lookup error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
