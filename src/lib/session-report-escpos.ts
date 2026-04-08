/**
 * session-report-escpos.ts — POS session close report layout for ESC/POS text printers.
 *
 * Uses the portable EscPosTextBuilder (no Node.js dependency).
 * Mirrors the data shown by POSSessionReportReceipt React component
 * but formatted for 80mm/58mm thermal printers via raw ESC/POS commands.
 */

import { EscPosTextBuilder } from "@/lib/escpos-text-builder";
import { format } from "date-fns";
import type {
  SessionReportData,
  SessionReportCompanyInfo,
  SessionReportLanguage,
} from "@/components/pos/session-report-receipt";

const PAYMENT_LABELS: Record<SessionReportLanguage, Record<string, string>> = {
  en: {
    CASH: "Cash",
    CREDIT_CARD: "Card",
    BANK_TRANSFER: "Bank Transfer",
    UPI: "UPI",
    CHECK: "Check",
    OTHER: "Other",
  },
  ar: {
    CASH: "Cash",
    CREDIT_CARD: "Card",
    BANK_TRANSFER: "Bank Transfer",
    UPI: "UPI",
    CHECK: "Check",
    OTHER: "Other",
  },
};

function fmtPayment(method: string, lang: SessionReportLanguage): string {
  return PAYMENT_LABELS[lang][method] || method.replace(/_/g, " ");
}

function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return "N/A";
  try {
    return format(new Date(value), "dd/MM/yyyy hh:mm a");
  } catch {
    return "N/A";
  }
}

function fmtDuration(openedAt: string | Date, closedAt: string | Date | null): string {
  const start = new Date(openedAt).getTime();
  const end = closedAt ? new Date(closedAt).getTime() : Date.now();
  const totalMinutes = Math.max(0, Math.round((end - start) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function fmtAmount(amount: number): string {
  return amount.toFixed(2);
}

export function buildSessionReportEscPos(
  report: SessionReportData,
  company?: SessionReportCompanyInfo | null,
  language: SessionReportLanguage = "en",
  options?: { paperWidth?: 48 | 32; cutPaper?: boolean },
): Uint8Array {
  const p = new EscPosTextBuilder(options?.paperWidth ?? 48);
  const s = report.session;
  const currency = report.organization?.currency || "INR";
  const currSymbol = currency === "SAR" ? "SAR" : "Rs";

  p.init();

  // ═══ HEADER ═══════════════════════════════════════════════
  p.printDoubleLine();
  p.alignCenter();
  p.bold(true);
  p.doubleHeight(true);
  const displayName = company?.companyName || report.organization?.name || "POS SESSION REPORT";
  p.println(displayName);
  p.setNormal();
  p.bold(false);

  // Secondary name
  const subName = company?.arabicName || report.organization?.arabicName;
  if (subName) {
    p.alignCenter();
    p.println(subName);
  }

  p.printDoubleLine();

  // Company details
  p.alignCenter();
  const address = [company?.companyAddress, company?.companyCity, company?.companyState]
    .filter(Boolean)
    .join(", ");
  if (address) p.println(address);
  if (company?.companyPhone) p.println(`Tel: ${company.companyPhone}`);
  if (company?.companyGstNumber) p.println(company.companyGstNumber);

  p.drawLine();

  // Title
  p.alignCenter();
  p.printBoxFrame("SESSION REPORT");

  p.drawLine();

  // ═══ SESSION INFO ══════════════════════════════════════════
  p.alignLeft();
  p.leftRight("Printed:", fmtDate(s.closedAt || new Date().toISOString()));
  p.leftRight("Session #:", s.sessionNumber);

  p.drawLine();

  // ═══ OVERVIEW ══════════════════════════════════════════════
  p.bold(true);
  p.println("SESSION OVERVIEW");
  p.bold(false);
  p.drawLine("-");

  const cashierName = s.employee?.name || s.user.name || s.user.email || "N/A";
  p.leftRight("Cashier:", cashierName);
  if (s.employee && s.user.name) {
    p.leftRight("Opened By:", s.user.name || s.user.email || "N/A");
  }
  p.leftRight("Closed By:", s.closedBy?.name || s.closedBy?.email || "N/A");
  if (s.branch) p.leftRight("Branch:", s.branch.name);
  if (s.warehouse) p.leftRight("Warehouse:", s.warehouse.name);
  p.leftRight("Status:", s.status);
  p.leftRight("Opened At:", fmtDate(s.openedAt));
  p.leftRight("Closed At:", fmtDate(s.closedAt));
  p.leftRight("Duration:", fmtDuration(s.openedAt, s.closedAt));

  if (s.notes?.trim()) {
    p.println(`Notes: ${s.notes.trim()}`);
  }

  p.drawLine();

  // ═══ CASH SUMMARY ══════════════════════════════════════════
  p.bold(true);
  p.println("CASH SUMMARY");
  p.bold(false);
  p.drawLine("-");

  const expectedCash = s.expectedCash ?? 0;
  const countedCash = s.closingCash ?? 0;
  const cashDiff = s.cashDifference ?? (countedCash - expectedCash);

  p.leftRight("Opening Cash:", `${currSymbol} ${fmtAmount(s.openingCash)}`);
  p.leftRight("Expected Cash:", `${currSymbol} ${fmtAmount(expectedCash)}`);
  p.leftRight("Counted Cash:", `${currSymbol} ${fmtAmount(countedCash)}`);

  p.bold(true);
  const diffStr = cashDiff >= 0 ? `+${fmtAmount(cashDiff)}` : fmtAmount(cashDiff);
  p.leftRight("Cash Difference:", `${currSymbol} ${diffStr}`);
  p.bold(false);

  p.drawLine();

  // ═══ SALES SUMMARY ═════════════════════════════════════════
  p.bold(true);
  p.println("SALES SUMMARY");
  p.bold(false);
  p.drawLine("-");

  p.leftRight("Total Sales:", `${currSymbol} ${fmtAmount(s.totalSales)}`);
  p.leftRight("Transactions:", String(s.totalTransactions));

  if (s.totalReturns > 0) {
    p.leftRight("Total Returns:", `${currSymbol} ${fmtAmount(s.totalReturns)}`);
    p.leftRight("Return Txns:", String(s.totalReturnTransactions));
    p.bold(true);
    p.leftRight("Net Sales:", `${currSymbol} ${fmtAmount(s.totalSales - s.totalReturns)}`);
    p.bold(false);
  }

  p.leftRight("Invoices:", String(report.totals.invoiceCount));
  p.leftRight("Total Qty Sold:", String(report.totals.totalQuantity));
  p.leftRight("Amount Paid:", `${currSymbol} ${fmtAmount(report.totals.totalPaid)}`);
  p.leftRight("Balance Due:", `${currSymbol} ${fmtAmount(report.totals.totalBalanceDue)}`);

  p.drawLine();

  // ═══ PAYMENT BREAKDOWN ═════════════════════════════════════
  p.bold(true);
  p.println("PAYMENT BREAKDOWN");
  p.bold(false);
  p.drawLine("-");

  if (report.paymentBreakdown.length > 0) {
    for (const pay of report.paymentBreakdown) {
      p.leftRight(
        `${fmtPayment(pay.method, language)} (${pay.count})`,
        `${currSymbol} ${fmtAmount(pay.total)}`
      );
    }
  } else {
    p.println("No payments recorded.");
  }

  p.drawLine();

  // ═══ PRODUCTS SUMMARY ══════════════════════════════════════
  p.bold(true);
  p.println("PRODUCTS SUMMARY");
  p.bold(false);
  p.drawLine("-");

  if (report.soldProducts.length > 0) {
    p.bold(true);
    p.tableCustom([
      { text: "PRODUCT", align: "LEFT", width: 0.45 },
      { text: "QTY", align: "CENTER", width: 0.15 },
      { text: "REVENUE", align: "RIGHT", width: 0.4 },
    ]);
    p.bold(false);
    p.drawLine("-");

    for (const product of report.soldProducts) {
      const name = product.name;
      p.tableCustom([
        { text: name.length > 20 ? name.substring(0, 19) + "." : name, align: "LEFT", width: 0.45 },
        { text: String(product.quantity), align: "CENTER", width: 0.15 },
        { text: fmtAmount(product.revenue), align: "RIGHT", width: 0.4 },
      ]);
    }
  } else {
    p.println("No products sold.");
  }

  p.drawLine();

  // ═══ INVOICE REGISTER ══════════════════════════════════════
  p.bold(true);
  p.println("INVOICE TOTALS");
  p.bold(false);
  p.drawLine("-");

  if (report.invoices.length > 0) {
    for (const inv of report.invoices) {
      p.leftRight(inv.invoiceNumber, `${currSymbol} ${fmtAmount(inv.total)}`);
    }
  } else {
    p.println("No invoices.");
  }

  p.printDoubleLine();
  p.newLine();
  p.newLine();

  if (options?.cutPaper !== false) {
    p.partialCut();
  }

  return p.toUint8Array();
}
