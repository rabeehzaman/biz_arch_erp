import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { buildPOSLocationKey } from "@/lib/pos/register-config";
import { getUserAllowedLocations } from "@/lib/pos/user-access";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const allowedLocations = await getUserAllowedLocations(
      prisma, organizationId, session.user.id!, (session.user as any).role || "user"
    );

    // Fetch all active branches with their warehouses
    const branches = await prisma.branch.findMany({
      where: { organizationId, isActive: true },
      include: {
        warehouses: {
          where: { isActive: true },
          select: { id: true, name: true, code: true },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    // Build locations list: each warehouse under its branch
    // If a branch has no warehouses, it shows as a single location
    const locations: Array<{
      branchId: string | null;
      branchName: string;
      branchCode: string;
      warehouseId: string | null;
      warehouseName: string | null;
      warehouseCode: string | null;
    }> = [];

    if (branches.length === 0) {
      // No branches set up — show a single default location
      locations.push({
        branchId: null,
        branchName: "Main Register",
        branchCode: "MAIN",
        warehouseId: null,
        warehouseName: null,
        warehouseCode: null,
      });
    } else {
      for (const branch of branches) {
        if (branch.warehouses.length === 0) {
          locations.push({
            branchId: branch.id,
            branchName: branch.name,
            branchCode: branch.code,
            warehouseId: null,
            warehouseName: null,
            warehouseCode: null,
          });
        } else {
          for (const wh of branch.warehouses) {
            locations.push({
              branchId: branch.id,
              branchName: branch.name,
              branchCode: branch.code,
              warehouseId: wh.id,
              warehouseName: wh.name,
              warehouseCode: wh.code,
            });
          }
        }
      }
    }

    // Filter locations by user access
    const filteredLocations = allowedLocations === null
      ? locations
      : locations.filter((loc) =>
          allowedLocations.some(
            (a) => a.branchId === loc.branchId && a.warehouseId === loc.warehouseId
          )
        );

    // Fetch all OPEN POS sessions for this org
    const openSessions = await prisma.pOSSession.findMany({
      where: { organizationId, status: "OPEN" },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        employee: {
          select: { id: true, name: true },
        },
        branch: {
          select: { id: true, name: true, code: true },
        },
        warehouse: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    // Filter open sessions by user access
    const filteredSessions = allowedLocations === null
      ? openSessions
      : openSessions.filter((s) =>
          allowedLocations.some(
            (a) => a.branchId === s.branchId && a.warehouseId === s.warehouseId
          )
        );

    const registerConfigs = await prisma.pOSRegisterConfig.findMany({
      where: { organizationId },
      include: {
        defaultCashAccount: { select: { id: true, name: true } },
        defaultBankAccount: { select: { id: true, name: true } },
      },
    });
    const configMap = new Map(
      registerConfigs.map((config) => [config.locationKey, config])
    );

    const locationsWithConfig = filteredLocations.map((location) => {
      const config = configMap.get(
        buildPOSLocationKey(location.branchId, location.warehouseId)
      );

      return {
        ...location,
        registerConfig: config
          ? {
            id: config.id,
            defaultCashAccountId: config.defaultCashAccountId,
            defaultBankAccountId: config.defaultBankAccountId,
            defaultCashAccount: config.defaultCashAccount,
            defaultBankAccount: config.defaultBankAccount,
          }
          : null,
      };
    });

    return NextResponse.json({ locations: locationsWithConfig, openSessions: filteredSessions });
  } catch (error) {
    console.error("Failed to fetch POS dashboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch POS dashboard" },
      { status: 500 }
    );
  }
}
