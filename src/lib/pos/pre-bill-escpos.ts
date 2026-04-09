/**
 * pre-bill-escpos.ts — ESC/POS text layout for pre-bill (estimated bill).
 *
 * Follows the same pattern as indian-receipt-escpos.ts and kot-escpos.ts.
 * Uses the portable EscPosTextBuilder (no Node.js dependencies).
 */

import type { PreBillReceiptData } from "@/components/pos/pre-bill-receipt";
import { EscPosTextBuilder } from "@/lib/escpos-text-builder";
import { format } from "date-fns";

export function buildPreBillEscPos(
  data: PreBillReceiptData,
  options?: { paperWidth?: 48 | 32; cutPaper?: boolean },
): Uint8Array {
  const p = new EscPosTextBuilder(options?.paperWidth ?? 48);
  const cur = data.currency || "SAR";
  const taxLbl = data.taxLabel || "Tax";
  const fmt = (n: number) => n.toFixed(2);

  p.init();

  // ═══ STORE HEADER ═══════════════════════════════════════
  p.printDoubleLine();
  p.alignCenter();
  p.bold(true);
  p.doubleHeight(true);
  p.println(data.storeName || "STORE");
  p.setNormal();
  p.bold(false);
  p.printDoubleLine();

  p.alignCenter();
  const address = [data.storeAddress, data.storeCity, data.storeState].filter(Boolean).join(", ");
  if (address) p.println(address);
  if (data.storePhone) p.println(`Tel: ${data.storePhone}`);

  if (data.vatNumber) {
    p.drawLine();
    p.alignCenter();
    p.bold(true);
    const vatLabel = taxLbl === "GST" ? "GSTIN" : taxLbl === "VAT" ? "VAT No" : "Tax ID";
    p.println(`${vatLabel}: ${data.vatNumber}`);
    p.bold(false);
  }

  p.drawLine();

  // ═══ ESTIMATED BILL LABEL ══════════════════════════════
  p.alignCenter();
  p.printBoxFrame("ESTIMATED BILL");

  p.drawLine();

  // ═══ ORDER INFO ════════════════════════════════════════
  p.alignLeft();
  p.leftRight(
    (data.orderType === "DINE_IN" ? "Dine-In" : "Takeaway") + (data.orderNumber ? ` #${data.orderNumber}` : ""),
    format(data.date, "dd/MM/yyyy"),
  );

  if (data.orderType === "DINE_IN" && (data.tableName || data.tableNumber != null)) {
    p.bold(true);
    const tableText = data.tableName || `#${data.tableNumber}`;
    const sectionText = data.section ? ` (${data.section})` : "";
    p.println(`Table: ${tableText}${sectionText}`);
    p.bold(false);
  }

  if (data.serverName) p.println(`Server: ${data.serverName}`);
  if (data.customerName) p.println(`Customer: ${data.customerName}`);
  p.leftRight("Time:", format(data.date, "hh:mm a"));

  p.drawLine();

  // ═══ COLUMN HEADERS ════════════════════════════════════
  p.bold(true);
  p.tableCustom([
    { text: "ITEM", align: "LEFT", width: 0.5 },
    { text: "QTY", align: "CENTER", width: 0.15 },
    { text: "AMOUNT", align: "RIGHT", width: 0.35 },
  ]);
  p.bold(false);
  p.drawLine();

  // ═══ LINE ITEMS ════════════════════════════════════════
  for (const item of data.items) {
    p.bold(true);
    p.println(item.name || "");
    p.bold(false);

    if (item.modifiers && item.modifiers.length > 0) {
      for (const mod of item.modifiers) {
        p.println(`  >> ${mod}`);
      }
    }

    const qtyPart = `${item.quantity} x ${fmt(item.unitPrice)}`;
    p.leftRight(`  ${qtyPart}`, fmt(item.lineTotal));

    if (item.discount > 0) {
      p.leftRight("  Disc:", `-${fmt(item.discount)}`);
    }
  }

  p.drawLine();

  // ═══ TOTALS ════════════════════════════════════════════
  p.leftRight("Subtotal:", fmt(data.subtotal));

  if (data.taxAmount !== 0) {
    const inclLabel = data.isTaxInclusivePrice ? " (Incl.)" : "";
    p.leftRight(`${taxLbl}${inclLabel}:`, fmt(data.taxAmount));
  }

  if (data.roundOffAmount != null && Math.abs(data.roundOffAmount) > 0.001) {
    const roStr = data.roundOffAmount > 0
      ? `+${fmt(data.roundOffAmount)}`
      : fmt(data.roundOffAmount);
    p.leftRight("Round Off:", roStr);
  }

  // ═══ TOTAL (double-height bold) ════════════════════════
  p.printDoubleLine();
  p.alignCenter();
  p.bold(true);
  p.doubleHeight(true);
  p.println(`TOTAL: ${cur} ${fmt(data.total)}`);
  p.setNormal();
  p.bold(false);
  p.printDoubleLine();

  // ═══ FOOTER ════════════════════════════════════════════
  p.alignCenter();
  p.println("Please present this bill");
  p.println("at the payment counter");

  p.drawLine();

  p.alignCenter();
  p.println("This is not a tax invoice");

  p.printDoubleLine();
  p.newLine();
  p.newLine();

  if (options?.cutPaper !== false) {
    p.partialCut();
  }

  return p.toUint8Array();
}
