import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getSubscriptionState } from "@/lib/subscription";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role;

  // Superadmin is always active
  if (role === "superadmin") {
    return NextResponse.json({
      status: "ACTIVE",
      endDate: null,
      daysRemaining: null,
      isExpired: false,
      isWarning: false,
      orgName: null,
    });
  }

  const organizationId = (session.user as { organizationId?: string })
    .organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      name: true,
      subscriptionStatus: true,
      subscriptionEndDate: true,
    },
  });

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const state = getSubscriptionState(org);

  return NextResponse.json({
    status: org.subscriptionStatus,
    endDate: org.subscriptionEndDate,
    daysRemaining: state.daysRemaining,
    isExpired: state.isExpired,
    isWarning: state.isWarning,
    orgName: org.name,
  });
}
