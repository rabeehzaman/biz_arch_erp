// PATCH /api/zatca/settings — Update ZATCA org settings
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { validateEnvironmentChange, type ZatcaEnvironment } from "@/lib/saudi-vat/zatca-config";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "admin" && role !== "superadmin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let organizationId: string;
  try {
    organizationId = getOrgId(session);
  } catch {
    return NextResponse.json({ error: "No organization context" }, { status: 400 });
  }

  const body = await req.json();
  const { clearanceAsync, environment } = body;

  const updateData: Record<string, unknown> = {};

  // Async clearance toggle
  if (typeof clearanceAsync === "boolean") {
    updateData.zatcaClearanceAsync = clearanceAsync;
  }

  // Environment change — production mode lock
  if (environment) {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { zatcaEnvironment: true },
    });

    const validation = validateEnvironmentChange(
      org.zatcaEnvironment as ZatcaEnvironment,
      environment as ZatcaEnvironment
    );
    if (!validation.allowed) {
      return NextResponse.json({ error: validation.reason }, { status: 400 });
    }
    updateData.zatcaEnvironment = environment;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: updateData,
  });

  return NextResponse.json({ success: true, ...updateData });
}
