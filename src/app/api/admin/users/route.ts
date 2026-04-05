import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hash } from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, password, role, organizationId } = body;

    if (!name || !email || !password || !organizationId) {
      return NextResponse.json(
        { error: "Name, email, password, and organization are required" },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ["admin", "user", "pos"];
    if (role && !validRoles.includes(role)) {
      return NextResponse.json(
        { error: "Role must be admin, user, or pos" },
        { status: 400 }
      );
    }

    // Check org exists
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Check for duplicate email
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    const userRole = role || "admin";

    if (existing) {
      // If user already exists, add them to this org instead of rejecting
      const existingMembership = await prisma.userOrganization.findUnique({
        where: {
          userId_organizationId: {
            userId: existing.id,
            organizationId,
          },
        },
      });
      if (existingMembership) {
        return NextResponse.json(
          { error: "This user is already a member of this organization" },
          { status: 409 }
        );
      }

      await prisma.userOrganization.create({
        data: {
          userId: existing.id,
          organizationId,
          role: userRole,
        },
      });

      return NextResponse.json(
        { id: existing.id, name: existing.name, email: existing.email, role: userRole, organizationId },
        { status: 201 }
      );
    }

    const hashedPassword = await hash(password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: userRole,
          organizationId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          organizationId: true,
        },
      });

      await tx.userOrganization.create({
        data: {
          userId: newUser.id,
          organizationId,
          role: userRole,
        },
      });

      return newUser;
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error("Failed to create user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
