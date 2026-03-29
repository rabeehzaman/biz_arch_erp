import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";
import {
  POS_PAYMENT_METHODS_KEY,
  filterPOSPaymentMethods,
  parseEnabledPOSPaymentMethods,
  serializeEnabledPOSPaymentMethods,
} from "@/lib/pos/payment-methods";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const setting = await prisma.setting.findFirst({
      where: { organizationId, key: POS_PAYMENT_METHODS_KEY, userId: null },
    });

    return NextResponse.json({
      methods: parseEnabledPOSPaymentMethods(setting?.value),
    });
  } catch (error) {
    console.error("Failed to fetch POS payment method settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch setting" },
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

    const organizationId = getOrgId(session);
    const body = await request.json();
    const methods = filterPOSPaymentMethods(
      Array.isArray(body?.methods) ? body.methods : null
    );

    if (methods.length === 0) {
      return NextResponse.json(
        { error: "At least one payment method must remain enabled" },
        { status: 400 }
      );
    }

    const existing = await prisma.setting.findFirst({
      where: { organizationId, key: POS_PAYMENT_METHODS_KEY, userId: null },
    });
    if (existing) {
      await prisma.setting.update({ where: { id: existing.id }, data: { value: serializeEnabledPOSPaymentMethods(methods) } });
    } else {
      await prisma.setting.create({ data: { organizationId, key: POS_PAYMENT_METHODS_KEY, value: serializeEnabledPOSPaymentMethods(methods) } });
    }

    return NextResponse.json({ success: true, methods });
  } catch (error) {
    console.error("Failed to update POS payment method settings:", error);
    return NextResponse.json(
      { error: "Failed to update setting" },
      { status: 500 }
    );
  }
}
