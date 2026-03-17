import prisma from "@/lib/prisma";

export interface VATDetailRow {
  id: string;
  docType: "INVOICE" | "CREDIT_NOTE" | "PURCHASE" | "DEBIT_NOTE";
  docNumber: string;
  date: string;
  partyName: string;
  subtotal: number;
  vatAmount: number;
  total: number;
}

export interface VATDetailData {
  rows: VATDetailRow[];
  totalTaxableOutput: number;
  totalVATOutput: number;
  totalTaxableInput: number;
  totalVATInput: number;
  netVATPayable: number;
}

export async function getVATDetailData(
  organizationId: string,
  fromDate: string,
  toDate: string
): Promise<VATDetailData> {
  const from = new Date(fromDate);
  const to = new Date(toDate + "T23:59:59.999Z");

  const [invoices, creditNotes, purchases, debitNotes] = await Promise.all([
    prisma.invoice.findMany({
      where: { organizationId, issueDate: { gte: from, lte: to } },
      select: {
        id: true,
        invoiceNumber: true,
        issueDate: true,
        subtotal: true,
        totalVat: true,
        total: true,
        customer: { select: { name: true } },
      },
      orderBy: { issueDate: "asc" },
    }),
    prisma.creditNote.findMany({
      where: { organizationId, issueDate: { gte: from, lte: to } },
      select: {
        id: true,
        creditNoteNumber: true,
        issueDate: true,
        subtotal: true,
        totalVat: true,
        total: true,
        customer: { select: { name: true } },
      },
      orderBy: { issueDate: "asc" },
    }),
    prisma.purchaseInvoice.findMany({
      where: { organizationId, invoiceDate: { gte: from, lte: to }, status: { not: "DRAFT" } },
      select: {
        id: true,
        purchaseInvoiceNumber: true,
        invoiceDate: true,
        subtotal: true,
        totalVat: true,
        total: true,
        supplier: { select: { name: true } },
      },
      orderBy: { invoiceDate: "asc" },
    }),
    prisma.debitNote.findMany({
      where: { organizationId, issueDate: { gte: from, lte: to } },
      select: {
        id: true,
        debitNoteNumber: true,
        issueDate: true,
        subtotal: true,
        totalVat: true,
        total: true,
        supplier: { select: { name: true } },
      },
      orderBy: { issueDate: "asc" },
    }),
  ]);

  const rows: VATDetailRow[] = [];

  for (const inv of invoices) {
    rows.push({
      id: inv.id,
      docType: "INVOICE",
      docNumber: inv.invoiceNumber,
      date: inv.issueDate.toISOString(),
      partyName: inv.customer.name,
      subtotal: Number(inv.subtotal),
      vatAmount: Number(inv.totalVat || 0),
      total: Number(inv.total),
    });
  }

  for (const cn of creditNotes) {
    rows.push({
      id: cn.id,
      docType: "CREDIT_NOTE",
      docNumber: cn.creditNoteNumber,
      date: cn.issueDate.toISOString(),
      partyName: cn.customer.name,
      subtotal: -Number(cn.subtotal),
      vatAmount: -Number(cn.totalVat || 0),
      total: -Number(cn.total),
    });
  }

  for (const pi of purchases) {
    rows.push({
      id: pi.id,
      docType: "PURCHASE",
      docNumber: pi.purchaseInvoiceNumber,
      date: pi.invoiceDate.toISOString(),
      partyName: pi.supplier.name,
      subtotal: Number(pi.subtotal),
      vatAmount: Number(pi.totalVat || 0),
      total: Number(pi.total),
    });
  }

  for (const dn of debitNotes) {
    rows.push({
      id: dn.id,
      docType: "DEBIT_NOTE",
      docNumber: dn.debitNoteNumber,
      date: dn.issueDate.toISOString(),
      partyName: dn.supplier.name,
      subtotal: -Number(dn.subtotal),
      vatAmount: -Number(dn.totalVat || 0),
      total: -Number(dn.total),
    });
  }

  // Sort all by date
  rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const outputRows = rows.filter((r) => r.docType === "INVOICE" || r.docType === "CREDIT_NOTE");
  const inputRows = rows.filter((r) => r.docType === "PURCHASE" || r.docType === "DEBIT_NOTE");

  const totalTaxableOutput = outputRows.reduce((s, r) => s + r.subtotal, 0);
  const totalVATOutput = outputRows.reduce((s, r) => s + r.vatAmount, 0);
  const totalTaxableInput = inputRows.reduce((s, r) => s + r.subtotal, 0);
  const totalVATInput = inputRows.reduce((s, r) => s + r.vatAmount, 0);

  return {
    rows,
    totalTaxableOutput,
    totalVATOutput,
    totalTaxableInput,
    totalVATInput,
    netVATPayable: totalVATOutput - totalVATInput,
  };
}
