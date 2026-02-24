import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const setting = await prisma.setting.findFirst({
      where: {
        organizationId: id,
        key: "disabledSidebarItems",
      },
    });

    let disabledSidebarItems: string[] = [];
    if (setting && setting.value) {
      try {
        disabledSidebarItems = JSON.parse(setting.value);
      } catch (e) {
         // ignore
      }
    }

    return NextResponse.json({ disabledSidebarItems });
  } catch (error) {
    console.error("Failed to fetch sidebar settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch sidebar settings" },
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
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { disabledSidebarItems } = body;

    if (!Array.isArray(disabledSidebarItems)) {
      return NextResponse.json(
        { error: "disabledSidebarItems must be an array" },
        { status: 400 }
      );
    }

    const value = JSON.stringify(disabledSidebarItems);

    await prisma.setting.upsert({
      where: {
        organizationId_key: {
          organizationId: id,
          key: "disabledSidebarItems",
        },
      },
      update: { value },
      create: {
        organizationId: id,
        key: "disabledSidebarItems",
        value,
      },
    });

    return NextResponse.json({ success: true, disabledSidebarItems });
  } catch (error) {
    console.error("Failed to update sidebar settings:", error);
    return NextResponse.json(
      { error: "Failed to update sidebar settings" },
      { status: 500 }
    );
  }
}
