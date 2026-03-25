import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { LANDING_PAGE_OPTIONS } from "@/lib/form-config/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id, userId } = await params;

    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId: id },
      select: { formDefaults: true, landingPage: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let formDefaults: Record<string, Record<string, string | number | boolean>> = {};
    if (user.formDefaults) {
      try {
        formDefaults = JSON.parse(user.formDefaults);
      } catch {
        // ignore
      }
    }

    return NextResponse.json({
      name: user.name,
      formDefaults,
      landingPage: user.landingPage || null,
    });
  } catch (error) {
    console.error("Failed to fetch user defaults:", error);
    return NextResponse.json(
      { error: "Failed to fetch user defaults" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id, userId } = await params;
    const body = await request.json();

    // Verify user belongs to org
    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId: id },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Validate landing page
    if (body.landingPage && body.landingPage !== "") {
      const validPages = LANDING_PAGE_OPTIONS.map((p) => p.value);
      if (!validPages.includes(body.landingPage)) {
        return NextResponse.json(
          { error: `Invalid landing page: ${body.landingPage}` },
          { status: 400 }
        );
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        formDefaults: body.formDefaults
          ? JSON.stringify(body.formDefaults)
          : null,
        landingPage: body.landingPage || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update user defaults:", error);
    return NextResponse.json(
      { error: "Failed to update user defaults" },
      { status: 500 }
    );
  }
}
