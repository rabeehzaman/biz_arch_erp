import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId, isJewelleryModuleEnabled } from "@/lib/auth-utils";
import { createAutoJournalEntry, ensureJewelleryAccounts } from "@/lib/accounting/journal";
import { createMetalLedgerEntry } from "@/lib/jewellery/metal-ledger";

const PURITY_KARAT_VALUES: Record<string, number> = {
  K24: 24,
  K22: 22,
  K21: 21,
  K18: 18,
  K14: 14,
  K9: 9,
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isJewelleryModuleEnabled(session)) {
      return NextResponse.json({ error: "Jewellery module is not enabled" }, { status: 403 });
    }

    const organizationId = getOrgId(session);
    const { id: karigarId } = await params;

    // Verify karigar belongs to org
    const karigar = await prisma.karigar.findFirst({
      where: { id: karigarId, organizationId },
      select: { id: true },
    });

    if (!karigar) {
      return NextResponse.json({ error: "Karigar not found" }, { status: 404 });
    }

    const transactions = await prisma.karigarTransaction.findMany({
      where: { karigarId, organizationId },
      orderBy: { date: "desc" },
      include: {
        jewelleryItem: {
          select: { id: true, tagNumber: true, purity: true },
        },
      },
    });

    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Failed to fetch karigar transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch karigar transactions" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isJewelleryModuleEnabled(session)) {
      return NextResponse.json({ error: "Jewellery module is not enabled" }, { status: 403 });
    }

    const organizationId = getOrgId(session);
    const { id: karigarId } = await params;
    const body = await request.json();
    const { type, weight, purity, jewelleryItemId, notes } = body;

    if (!type || weight === undefined || !purity) {
      return NextResponse.json(
        { error: "type, weight, and purity are required" },
        { status: 400 }
      );
    }

    const validTypes = ["ISSUE", "RETURN", "WASTAGE", "SCRAP"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const karatValue = PURITY_KARAT_VALUES[purity];
    if (karatValue === undefined) {
      return NextResponse.json(
        { error: `Invalid purity. Must be one of: ${Object.keys(PURITY_KARAT_VALUES).join(", ")}` },
        { status: 400 }
      );
    }

    const numWeight = Number(weight);
    const fineWeight = Math.round((numWeight * (karatValue / 24)) * 1000) / 1000;

    // Use transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Verify karigar belongs to org
      const karigar = await tx.karigar.findFirst({
        where: { id: karigarId, organizationId },
      });

      if (!karigar) {
        throw new Error("KARIGAR_NOT_FOUND");
      }

      // Create the transaction record
      const transaction = await tx.karigarTransaction.create({
        data: {
          organizationId,
          karigarId,
          type,
          weight: numWeight,
          purity,
          fineWeight,
          jewelleryItemId: jewelleryItemId || null,
          notes: notes || null,
        },
        include: {
          jewelleryItem: {
            select: { id: true, tagNumber: true, purity: true },
          },
        },
      });

      // Update karigar running totals based on transaction type
      const updateData: Record<string, unknown> = {};
      if (type === "ISSUE") {
        updateData.goldIssuedWeight = { increment: numWeight };
      } else if (type === "RETURN") {
        updateData.goldReturnedWeight = { increment: numWeight };
      } else if (type === "SCRAP") {
        updateData.scrapReturnedWeight = { increment: numWeight };
      }
      // WASTAGE is just recorded, no running total update

      if (Object.keys(updateData).length > 0) {
        await tx.karigar.update({
          where: { id: karigarId },
          data: updateData,
        });
      }

      // Metal ledger entry
      const metalDirection = (type === "ISSUE" || type === "WASTAGE") ? "OUTFLOW" as const : "INFLOW" as const;
      const metalSourceType = type === "ISSUE" ? "KARIGAR_ISSUE"
        : type === "RETURN" ? "KARIGAR_RETURN"
        : type === "WASTAGE" ? "WASTAGE"
        : "SCRAP";

      await createMetalLedgerEntry(tx, organizationId, {
        date: new Date(),
        metalType: "GOLD",
        purity,
        grossWeight: numWeight,
        fineWeight,
        direction: metalDirection,
        description: `Karigar ${type.toLowerCase()} - ${karigar.name} (${numWeight}g ${purity})`,
        sourceType: metalSourceType,
        sourceId: transaction.id,
        jewelleryItemId: jewelleryItemId || null,
        karigarId,
      });

      // GL journal entry for karigar gold movement
      const jwAccounts = await ensureJewelleryAccounts(tx, organizationId);
      if (jwAccounts) {
        // Calculate monetary value for GL (use a nominal rate based on fine weight)
        // For karigar tracking, we use fine weight as the GL value proxy
        // since the actual monetary value depends on gold rate at time of sale
        const goldRate = await tx.goldRate.findFirst({
          where: { organizationId, purity: purity as any, metalType: "GOLD" },
          orderBy: { date: "desc" },
          select: { sellRate: true },
        });
        const rate = goldRate ? Number(goldRate.sellRate) : 0;
        const monetaryValue = Math.round(numWeight * rate * 100) / 100;

        if (monetaryValue > 0) {
          let debitAccountId: string;
          let creditAccountId: string;
          let description: string;

          if (type === "ISSUE") {
            debitAccountId = jwAccounts.goldWithKarigars.id;
            creditAccountId = jwAccounts.goldInventory.id;
            description = `Gold issued to ${karigar.name}`;
          } else if (type === "RETURN") {
            debitAccountId = jwAccounts.goldInventory.id;
            creditAccountId = jwAccounts.goldWithKarigars.id;
            description = `Gold returned by ${karigar.name}`;
          } else if (type === "WASTAGE") {
            debitAccountId = jwAccounts.makingCOGS.id;
            creditAccountId = jwAccounts.goldWithKarigars.id;
            description = `Karigar wastage - ${karigar.name}`;
          } else {
            // SCRAP — returns to inventory
            debitAccountId = jwAccounts.goldInventory.id;
            creditAccountId = jwAccounts.goldWithKarigars.id;
            description = `Scrap returned by ${karigar.name}`;
          }

          await createAutoJournalEntry(tx, organizationId, {
            date: new Date(),
            description,
            sourceType: "KARIGAR_TRANSACTION",
            sourceId: transaction.id,
            lines: [
              { accountId: debitAccountId, debit: monetaryValue, credit: 0 },
              { accountId: creditAccountId, debit: 0, credit: monetaryValue },
            ],
          });
        }
      }

      return transaction;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "KARIGAR_NOT_FOUND") {
      return NextResponse.json({ error: "Karigar not found" }, { status: 404 });
    }
    console.error("Failed to create karigar transaction:", error);
    return NextResponse.json(
      { error: "Failed to create karigar transaction" },
      { status: 500 }
    );
  }
}
