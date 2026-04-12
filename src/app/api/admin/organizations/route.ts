import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { seedAllAccountsForNewOrg, seedDefaultUnits } from "@/lib/accounting/seed-coa";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const organizations = await prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { users: true, customers: true, invoices: true },
        },
      },
    });

    return NextResponse.json(organizations);
  } catch (error) {
    console.error("Failed to fetch organizations:", error);
    return NextResponse.json(
      { error: "Failed to fetch organizations" },
      { status: 500 }
    );
  }
}

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
    const { name, slug, edition } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Name and slug are required" },
        { status: 400 }
      );
    }

    // Validate edition if provided
    if (edition && !["INDIA", "SAUDI"].includes(edition)) {
      return NextResponse.json(
        { error: "Edition must be 'INDIA' or 'SAUDI'" },
        { status: 400 }
      );
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: "Slug must contain only lowercase letters, numbers, and hyphens" },
        { status: 400 }
      );
    }

    // Check for duplicate slug
    const existing = await prisma.organization.findUnique({
      where: { slug },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An organization with this slug already exists" },
        { status: 409 }
      );
    }

    // Set defaults based on edition
    const editionValue = edition || "INDIA";
    const orgData: Record<string, unknown> = { name, slug, edition: editionValue };
    if (editionValue === "SAUDI") {
      orgData.currency = "SAR";
      orgData.language = "en";
      orgData.saudiEInvoiceEnabled = true;
    } else {
      orgData.currency = "INR";
      orgData.language = "en";
      orgData.gstEnabled = true;
    }

    const organization = await prisma.organization.create({
      data: orgData as never,
    });

    // Seed chart of accounts and default units for the new organization.
    // Uses a single-batch seeder to avoid Vercel serverless timeouts.
    // On failure, clean up accounts/units before deleting the org to avoid
    // FK constraint violations (no ON DELETE CASCADE on account → org).
    try {
      await seedAllAccountsForNewOrg(prisma as never, organization.id, editionValue);
      await seedDefaultUnits(prisma as never, organization.id);
    } catch (coaError) {
      console.error("Failed to seed new org:", coaError);
      try {
        await prisma.cashBankAccount.deleteMany({ where: { organizationId: organization.id } });
        await prisma.account.deleteMany({ where: { organizationId: organization.id } });
        await prisma.unit.deleteMany({ where: { organizationId: organization.id } });
        await prisma.organization.delete({ where: { id: organization.id } });
      } catch (cleanupErr) {
        console.error("Failed to cleanup org after seed failure:", cleanupErr);
      }
      return NextResponse.json(
        { error: "Organization created but failed to seed chart of accounts. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(organization, { status: 201 });
  } catch (error) {
    console.error("Failed to create organization:", error);
    return NextResponse.json(
      { error: "Failed to create organization" },
      { status: 500 }
    );
  }
}
