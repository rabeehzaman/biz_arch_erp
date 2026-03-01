// Saudi e-Invoice hash chain and counter utilities for ZATCA Phase 1

import crypto from "crypto";

// ─── UUID Generation ───────────────────────────────────────────────────────

export function generateInvoiceUUID(): string {
  return crypto.randomUUID();
}

// ─── SHA-256 Invoice Hash ──────────────────────────────────────────────────

export interface InvoiceHashInput {
  invoiceNumber: string;
  issueDate: string;       // ISO 8601 date
  sellerVatNumber: string;
  totalInclVat: string;    // formatted as "1000.00"
  totalVat: string;        // formatted as "150.00"
}

export function computeInvoiceHash(data: InvoiceHashInput): string {
  const content = [
    data.invoiceNumber,
    data.issueDate,
    data.sellerVatNumber,
    data.totalInclVat,
    data.totalVat,
  ].join("|");

  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

// The first invoice in an org's chain uses this as previousInvoiceHash
export const GENESIS_INVOICE_HASH = "0".repeat(64);

// ─── Invoice Counter Value (ICV) ───────────────────────────────────────────
// The ICV must increment monotonically and never reset.
// We compute it at query time by fetching max(invoiceCounterValue) from DB.
// This function is called from the API route with a Prisma client.

export async function getNextICV(
  prisma: {
    invoice: {
      aggregate: (args: {
        where: { organizationId: string; invoiceCounterValue: { not: null } };
        _max: { invoiceCounterValue: boolean };
      }) => Promise<{ _max: { invoiceCounterValue: number | null } }>;
    };
  },
  organizationId: string
): Promise<number> {
  const result = await prisma.invoice.aggregate({
    where: { organizationId, invoiceCounterValue: { not: null } },
    _max: { invoiceCounterValue: true },
  });
  return (result._max.invoiceCounterValue ?? 0) + 1;
}

export async function getLastInvoiceHash(
  prisma: {
    invoice: {
      findFirst: (args: {
        where: { organizationId: string; invoiceCounterValue: { not: null } };
        orderBy: { invoiceCounterValue: "desc" };
        select: { invoiceHash: boolean };
      }) => Promise<{ invoiceHash: string | null } | null>;
    };
  },
  organizationId: string
): Promise<string> {
  const last = await prisma.invoice.findFirst({
    where: { organizationId, invoiceCounterValue: { not: null } },
    orderBy: { invoiceCounterValue: "desc" },
    select: { invoiceHash: true },
  });
  return last?.invoiceHash ?? GENESIS_INVOICE_HASH;
}
