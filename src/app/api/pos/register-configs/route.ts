import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { buildPOSLocationKey } from "@/lib/pos/register-config";

function parseNullableId(value: string | null): string | null {
  if (!value || value === "null") return null;
  return value;
}

async function normalizeLocation(
  organizationId: string,
  branchId: string | null,
  warehouseId: string | null
) {
  let effectiveBranchId = branchId;

  if (effectiveBranchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: effectiveBranchId, organizationId },
      select: { id: true },
    });
    if (!branch) {
      throw new Error("INVALID_BRANCH");
    }
  }

  if (warehouseId) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, organizationId },
      select: { id: true, branchId: true },
    });
    if (!warehouse) {
      throw new Error("INVALID_WAREHOUSE");
    }
    if (effectiveBranchId && warehouse.branchId !== effectiveBranchId) {
      throw new Error("WAREHOUSE_BRANCH_MISMATCH");
    }
    effectiveBranchId = warehouse.branchId;
  }

  return {
    branchId: effectiveBranchId,
    warehouseId,
    locationKey: buildPOSLocationKey(effectiveBranchId, warehouseId),
  };
}

async function validateCashBankAccount(
  organizationId: string,
  accountId: string | null,
  accountSubType: "CASH" | "BANK"
) {
  if (!accountId) return null;

  const account = await prisma.cashBankAccount.findFirst({
    where: {
      id: accountId,
      organizationId,
      accountSubType,
      isActive: true,
    },
    select: { id: true, name: true },
  });

  if (!account) {
    throw new Error(accountSubType === "CASH" ? "INVALID_CASH_ACCOUNT" : "INVALID_BANK_ACCOUNT");
  }

  return account;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "admin" && session.user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const organizationId = getOrgId(session);
    const { searchParams } = new URL(request.url);
    const branchId = parseNullableId(searchParams.get("branchId"));
    const warehouseId = parseNullableId(searchParams.get("warehouseId"));

    if (searchParams.has("branchId") || searchParams.has("warehouseId")) {
      const { branchId: effectiveBranchId, warehouseId: effectiveWarehouseId, locationKey } =
        await normalizeLocation(organizationId, branchId, warehouseId);

      const config = await prisma.pOSRegisterConfig.findUnique({
        where: {
          organizationId_locationKey: { organizationId, locationKey },
        },
        include: {
          defaultCashAccount: { select: { id: true, name: true } },
          defaultBankAccount: { select: { id: true, name: true } },
        },
      });

      return NextResponse.json({
        config: config
          ? {
            ...config,
            branchId: effectiveBranchId,
            warehouseId: effectiveWarehouseId,
          }
          : null,
      });
    }

    const configs = await prisma.pOSRegisterConfig.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      include: {
        defaultCashAccount: { select: { id: true, name: true } },
        defaultBankAccount: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(configs);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INVALID_BRANCH") {
        return NextResponse.json({ error: "Invalid branch selected." }, { status: 400 });
      }
      if (error.message === "INVALID_WAREHOUSE") {
        return NextResponse.json({ error: "Invalid warehouse selected." }, { status: 400 });
      }
      if (error.message === "WAREHOUSE_BRANCH_MISMATCH") {
        return NextResponse.json({ error: "Warehouse does not belong to the selected branch." }, { status: 400 });
      }
    }

    console.error("Failed to fetch POS register configs:", error);
    return NextResponse.json(
      { error: "Failed to fetch POS register configs" },
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
    const branchId = parseNullableId(body.branchId ?? null);
    const warehouseId = parseNullableId(body.warehouseId ?? null);
    const defaultCashAccountId = parseNullableId(body.defaultCashAccountId ?? null);
    const defaultBankAccountId = parseNullableId(body.defaultBankAccountId ?? null);

    const { branchId: effectiveBranchId, warehouseId: effectiveWarehouseId, locationKey } =
      await normalizeLocation(organizationId, branchId, warehouseId);

    await validateCashBankAccount(organizationId, defaultCashAccountId, "CASH");
    await validateCashBankAccount(organizationId, defaultBankAccountId, "BANK");

    if (!defaultCashAccountId && !defaultBankAccountId) {
      await prisma.pOSRegisterConfig.deleteMany({
        where: {
          organizationId,
          locationKey,
        },
      });

      return NextResponse.json({ config: null });
    }

    const config = await prisma.pOSRegisterConfig.upsert({
      where: {
        organizationId_locationKey: {
          organizationId,
          locationKey,
        },
      },
      create: {
        organizationId,
        branchId: effectiveBranchId,
        warehouseId: effectiveWarehouseId,
        locationKey,
        defaultCashAccountId,
        defaultBankAccountId,
      },
      update: {
        branchId: effectiveBranchId,
        warehouseId: effectiveWarehouseId,
        defaultCashAccountId,
        defaultBankAccountId,
      },
      include: {
        defaultCashAccount: { select: { id: true, name: true } },
        defaultBankAccount: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ config });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INVALID_BRANCH") {
        return NextResponse.json({ error: "Invalid branch selected." }, { status: 400 });
      }
      if (error.message === "INVALID_WAREHOUSE") {
        return NextResponse.json({ error: "Invalid warehouse selected." }, { status: 400 });
      }
      if (error.message === "WAREHOUSE_BRANCH_MISMATCH") {
        return NextResponse.json({ error: "Warehouse does not belong to the selected branch." }, { status: 400 });
      }
      if (error.message === "INVALID_CASH_ACCOUNT") {
        return NextResponse.json({ error: "Invalid cash account selected." }, { status: 400 });
      }
      if (error.message === "INVALID_BANK_ACCOUNT") {
        return NextResponse.json({ error: "Invalid bank account selected." }, { status: 400 });
      }
    }

    console.error("Failed to save POS register config:", error);
    return NextResponse.json(
      { error: "Failed to save POS register config" },
      { status: 500 }
    );
  }
}
