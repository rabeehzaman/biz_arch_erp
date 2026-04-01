import prisma from "@/lib/prisma";

export interface GSTDetailRow {
  id: string;
  docType: "INVOICE" | "CREDIT_NOTE" | "PURCHASE" | "DEBIT_NOTE";
  docNumber: string;
  date: string;
  partyName: string;
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export interface GSTDetailData {
  rows: GSTDetailRow[];
  totalTaxableOutput: number;
  totalCGSTOutput: number;
  totalSGSTOutput: number;
  totalIGSTOutput: number;
  totalTaxableInput: number;
  totalCGSTInput: number;
  totalSGSTInput: number;
  totalIGSTInput: number;
  netLiabilityCGST: number;
  netLiabilitySGST: number;
  netLiabilityIGST: number;
}

export async function getGSTDetailData(
  organizationId: string,
  fromDate: string,
  toDate: string,
  branchId?: string
): Promise<GSTDetailData> {
  const from = new Date(fromDate);
  const to = new Date(toDate + "T23:59:59.999Z");

  const [invoices, creditNotes, purchases, debitNotes] = await Promise.all([
    prisma.invoice.findMany({
      where: { organizationId, issueDate: { gte: from, lte: to }, ...(branchId ? { branchId } : {}) },
      select: {
        id: true,
        invoiceNumber: true,
        issueDate: true,
        subtotal: true,
        totalCgst: true,
        totalSgst: true,
        totalIgst: true,
        total: true,
        customer: { select: { name: true } },
      },
      orderBy: { issueDate: "asc" },
    }),
    prisma.creditNote.findMany({
      where: { organizationId, issueDate: { gte: from, lte: to }, ...(branchId ? { branchId } : {}) },
      select: {
        id: true,
        creditNoteNumber: true,
        issueDate: true,
        subtotal: true,
        totalCgst: true,
        totalSgst: true,
        totalIgst: true,
        total: true,
        customer: { select: { name: true } },
      },
      orderBy: { issueDate: "asc" },
    }),
    prisma.purchaseInvoice.findMany({
      where: { organizationId, invoiceDate: { gte: from, lte: to }, status: { not: "DRAFT" }, ...(branchId ? { branchId } : {}) },
      select: {
        id: true,
        purchaseInvoiceNumber: true,
        invoiceDate: true,
        subtotal: true,
        totalCgst: true,
        totalSgst: true,
        totalIgst: true,
        total: true,
        supplier: { select: { name: true } },
      },
      orderBy: { invoiceDate: "asc" },
    }),
    prisma.debitNote.findMany({
      where: { organizationId, issueDate: { gte: from, lte: to }, ...(branchId ? { branchId } : {}) },
      select: {
        id: true,
        debitNoteNumber: true,
        issueDate: true,
        subtotal: true,
        totalCgst: true,
        totalSgst: true,
        totalIgst: true,
        total: true,
        supplier: { select: { name: true } },
      },
      orderBy: { issueDate: "asc" },
    }),
  ]);

  const rows: GSTDetailRow[] = [];

  for (const inv of invoices) {
    rows.push({
      id: inv.id,
      docType: "INVOICE",
      docNumber: inv.invoiceNumber,
      date: inv.issueDate.toISOString(),
      partyName: inv.customer.name,
      subtotal: Number(inv.subtotal),
      cgst: Number(inv.totalCgst),
      sgst: Number(inv.totalSgst),
      igst: Number(inv.totalIgst),
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
      cgst: -Number(cn.totalCgst),
      sgst: -Number(cn.totalSgst),
      igst: -Number(cn.totalIgst),
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
      cgst: Number(pi.totalCgst),
      sgst: Number(pi.totalSgst),
      igst: Number(pi.totalIgst),
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
      cgst: -Number(dn.totalCgst),
      sgst: -Number(dn.totalSgst),
      igst: -Number(dn.totalIgst),
      total: -Number(dn.total),
    });
  }

  rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const outputRows = rows.filter((r) => r.docType === "INVOICE" || r.docType === "CREDIT_NOTE");
  const inputRows = rows.filter((r) => r.docType === "PURCHASE" || r.docType === "DEBIT_NOTE");

  const totalTaxableOutput = outputRows.reduce((s, r) => s + r.subtotal, 0);
  const totalCGSTOutput = outputRows.reduce((s, r) => s + r.cgst, 0);
  const totalSGSTOutput = outputRows.reduce((s, r) => s + r.sgst, 0);
  const totalIGSTOutput = outputRows.reduce((s, r) => s + r.igst, 0);
  const totalTaxableInput = inputRows.reduce((s, r) => s + r.subtotal, 0);
  const totalCGSTInput = inputRows.reduce((s, r) => s + r.cgst, 0);
  const totalSGSTInput = inputRows.reduce((s, r) => s + r.sgst, 0);
  const totalIGSTInput = inputRows.reduce((s, r) => s + r.igst, 0);

  return {
    rows,
    totalTaxableOutput,
    totalCGSTOutput,
    totalSGSTOutput,
    totalIGSTOutput,
    totalTaxableInput,
    totalCGSTInput,
    totalSGSTInput,
    totalIGSTInput,
    netLiabilityCGST: totalCGSTOutput - totalCGSTInput,
    netLiabilitySGST: totalSGSTOutput - totalSGSTInput,
    netLiabilityIGST: totalIGSTOutput - totalIGSTInput,
  };
}
