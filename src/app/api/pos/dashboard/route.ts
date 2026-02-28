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

    // Fetch all OPEN POS sessions for this org
    const openSessions = await prisma.pOSSession.findMany({
      where: { organizationId, status: "OPEN" },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        branch: {
          select: { id: true, name: true, code: true },
        },
        warehouse: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    return NextResponse.json({ locations, openSessions });
  } catch (error) {
    console.error("Failed to fetch POS dashboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch POS dashboard" },
      { status: 500 }
    );
  }
}
