// Shared helper for computing GST on document line items
// Used by all API routes: invoices, purchase invoices, credit/debit notes, quotations, expenses, POS

import { calculateFullDocumentGST } from "./calculator";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any;

interface GSTOrgInfo {
  gstEnabled: boolean;
  gstStateCode: string | null;
}

export async function getOrgGSTInfo(
  tx: Tx,
  organizationId: string
): Promise<GSTOrgInfo> {
  const org = await tx.organization.findUnique({
    where: { id: organizationId },
    select: { gstEnabled: true, gstStateCode: true },
  });
  return {
    gstEnabled: org?.gstEnabled ?? false,
    gstStateCode: org?.gstStateCode ?? null,
  };
}

export interface LineItemForGST {
  taxableAmount: number;
  gstRate: number;
  hsnCode?: string | null;
}

export interface ComputedLineGST {
  hsnCode: string | null;
  gstRate: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
}

export interface ComputedDocumentGST {
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  placeOfSupply: string | null;
  isInterState: boolean;
  totalTax: number;
  lineGST: ComputedLineGST[];
}

/**
 * Compute GST for a document.
 * Returns zero GST if org is not GST-enabled.
 */
export function computeDocumentGST(
  orgInfo: GSTOrgInfo,
  lines: LineItemForGST[],
  counterpartyGstin?: string | null,
  counterpartyStateCode?: string | null
): ComputedDocumentGST {
  if (!orgInfo.gstEnabled || !orgInfo.gstStateCode) {
    // Non-GST org: return zeros
    return {
      totalCgst: 0,
      totalSgst: 0,
      totalIgst: 0,
      placeOfSupply: null,
      isInterState: false,
      totalTax: 0,
      lineGST: lines.map(() => ({
        hsnCode: null,
        gstRate: 0,
        cgstRate: 0,
        sgstRate: 0,
        igstRate: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
      })),
    };
  }

  const result = calculateFullDocumentGST(
    lines.map((l) => ({
      taxableAmount: l.taxableAmount,
      gstRate: l.gstRate,
      hsnCode: l.hsnCode,
    })),
    orgInfo.gstStateCode,
    counterpartyGstin,
    counterpartyStateCode
  );

  return {
    totalCgst: result.totals.totalCgst,
    totalSgst: result.totals.totalSgst,
    totalIgst: result.totals.totalIgst,
    placeOfSupply: result.placeOfSupply,
    isInterState: result.isInterState,
    totalTax: result.totals.totalTax,
    lineGST: result.lines.map((l) => ({
      hsnCode: l.hsnCode,
      gstRate: l.gstRate,
      cgstRate: l.cgstRate,
      sgstRate: l.sgstRate,
      igstRate: l.igstRate,
      cgstAmount: l.cgstAmount,
      sgstAmount: l.sgstAmount,
      igstAmount: l.igstAmount,
    })),
  };
}
