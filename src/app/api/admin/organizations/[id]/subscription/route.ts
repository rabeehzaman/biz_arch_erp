import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getSubscriptionState } from "@/lib/subscription";
import type { SubscriptionStatus } from "@/generated/prisma/client";

const VALID_STATUSES: SubscriptionStatus[] = [
  "TRIAL",
  "ACTIVE",
  "EXPIRED",
  "SUSPENDED",
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const org = await prisma.organization.findUnique({
      where: { id },
      select: {
        subscriptionStatus: true,
        subscriptionStartDate: true,
        subscriptionEndDate: true,
        subscriptionNotes: true,
      },
    });

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const state = getSubscriptionState(org);

    const logs = await prisma.subscriptionLog.findMany({
      where: { organizationId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      subscription: {
        status: org.subscriptionStatus,
        startDate: org.subscriptionStartDate,
        endDate: org.subscriptionEndDate,
        notes: org.subscriptionNotes,
        isExpired: state.isExpired,
        isWarning: state.isWarning,
        daysRemaining: state.daysRemaining,
      },
      logs,
    });
  } catch (error) {
    console.error("Failed to fetch subscription:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, startDate, endDate, notes } = body as {
      status?: string;
      startDate?: string | null;
      endDate?: string | null;
      notes?: string | null;
    };

    // Validate status
    if (status && !VALID_STATUSES.includes(status as SubscriptionStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate dates
    if (endDate && startDate && new Date(endDate) < new Date(startDate)) {
      return NextResponse.json(
        { error: "End date cannot be before start date" },
        { status: 400 }
      );
    }

    // Fetch current state for audit log
    const currentOrg = await prisma.organization.findUnique({
      where: { id },
      select: {
        subscriptionStatus: true,
        subscriptionEndDate: true,
      },
    });

    if (!currentOrg) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (status) updateData.subscriptionStatus = status as SubscriptionStatus;
    if (startDate !== undefined)
      updateData.subscriptionStartDate = startDate
        ? new Date(startDate)
        : null;
    if (endDate !== undefined)
      updateData.subscriptionEndDate = endDate ? new Date(endDate) : null;
    if (notes !== undefined) updateData.subscriptionNotes = notes;

    // Update org and create audit log in a transaction
    const [updatedOrg] = await prisma.$transaction([
      prisma.organization.update({
        where: { id },
        data: updateData,
        select: {
          subscriptionStatus: true,
          subscriptionStartDate: true,
          subscriptionEndDate: true,
          subscriptionNotes: true,
        },
      }),
      prisma.subscriptionLog.create({
        data: {
          organizationId: id,
          previousStatus: currentOrg.subscriptionStatus,
          newStatus: (status as SubscriptionStatus) ?? currentOrg.subscriptionStatus,
          previousEndDate: currentOrg.subscriptionEndDate,
          newEndDate: endDate !== undefined
            ? (endDate ? new Date(endDate) : null)
            : currentOrg.subscriptionEndDate,
          changedBy: session.user.id,
          note: notes ?? null,
        },
      }),
    ]);

    const state = getSubscriptionState(updatedOrg);

    return NextResponse.json({
      subscription: {
        status: updatedOrg.subscriptionStatus,
        startDate: updatedOrg.subscriptionStartDate,
        endDate: updatedOrg.subscriptionEndDate,
        notes: updatedOrg.subscriptionNotes,
        isExpired: state.isExpired,
        isWarning: state.isWarning,
        daysRemaining: state.daysRemaining,
      },
    });
  } catch (error) {
    console.error("Failed to update subscription:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
