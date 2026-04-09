/**
 * indian-receipt-escpos.ts — Indian GST receipt layout for browser/Capacitor.
 *
 * Mirrors the layout from electron/printer-service.js buildIndianGSTReceiptBuffer()
 * but uses the portable EscPosTextBuilder instead of node-thermal-printer.
 *
 * Accepts ReceiptData directly (no intermediate mapping) to avoid circular
 * dependency with electron-print.ts.
 */

import type { ReceiptData } from "@/components/pos/receipt";
import { EscPosTextBuilder } from "@/lib/escpos-text-builder";
import { format } from "date-fns";

export function buildIndianGSTReceiptEscPos(
  data: ReceiptData,
  options?: { paperWidth?: 48 | 32; cutPaper?: boolean; openDrawer?: boolean },
): Uint8Array {
  const p = new EscPosTextBuilder(options?.paperWidth ?? 48);
  const isInterState = data.isInterState || false;

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

  p.drawLine();

  // GSTIN
  const gstin = data.vatNumber || data.storeGstin;
  if (gstin) {
    p.alignCenter();
    p.bold(true);
    p.println(`GSTIN: ${gstin}`);
    p.bold(false);
  }

  p.drawLine();

  // ═══ TAX INVOICE / BILL OF SUPPLY ══════════════════════
  const hasTax = (data.totalCgst || 0) + (data.totalSgst || 0) + (data.totalIgst || 0) > 0;
  const docLabel = hasTax ? "TAX INVOICE" : "BILL OF SUPPLY";

  p.alignCenter();
  p.printBoxFrame(docLabel);

  p.drawLine();

  // ═══ INVOICE INFO ══════════════════════════════════════
  p.alignLeft();
  if (data.invoiceNumber) p.println(`Invoice: ${data.invoiceNumber}`);
  if (data.date) p.println(`Date: ${format(data.date, "dd/MM/yyyy hh:mm a")}`);
  if (data.customerName) p.println(`Customer: ${data.customerName}`);
  if (data.orderType === "DINE_IN" && (data.tableName || data.tableNumber != null)) {
    p.bold(true);
    p.println(`Table: ${data.tableName || `#${data.tableNumber}`}${data.orderNumber ? ` · Order #${data.orderNumber}` : ""}`);
    p.bold(false);
  }
  if (data.orderType === "TAKEAWAY") {
    p.bold(true);
    p.println(`Takeaway${data.orderNumber ? ` · Order #${data.orderNumber}` : ""}`);
    p.bold(false);
  }

  if (data.placeOfSupplyName || data.placeOfSupply) {
    const posText =
      data.placeOfSupply && data.placeOfSupplyName
        ? `${data.placeOfSupply} - ${data.placeOfSupplyName}`
        : data.placeOfSupplyName || data.placeOfSupply;
    p.println(`Place of Supply: ${posText}`);
  }

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

    const hsnPart = item.hsnCode ? `HSN:${item.hsnCode}` : "";
    const qtyPart = `${item.quantity} x ${item.unitPrice.toFixed(2)}`;
    const detailLeft = [hsnPart, qtyPart].filter(Boolean).join("  ");
    p.leftRight(`  ${detailLeft}`, item.lineTotal.toFixed(2));

    const gstRate = item.gstRate || 0;
    if (gstRate > 0) {
      let gstDetail: string;
      if (isInterState) {
        gstDetail = `GST ${gstRate}% (IGST ${gstRate}%)`;
      } else {
        const halfRate = gstRate / 2;
        gstDetail = `GST ${gstRate}% (CGST ${halfRate}%+SGST ${halfRate}%)`;
      }
      p.println(`  ${gstDetail}`);
    }
  }

  p.drawLine();

  // ═══ TOTALS ════════════════════════════════════════════
  p.leftRight("Subtotal:", data.subtotal.toFixed(2));

  // GST grouped by rate
  const taxByRate: Record<number, { cgst: number; sgst: number; igst: number }> = {};
  for (const item of data.items) {
    const rate = item.gstRate || 0;
    if (rate <= 0) continue;
    if (!taxByRate[rate]) taxByRate[rate] = { cgst: 0, sgst: 0, igst: 0 };
    taxByRate[rate].cgst += item.cgstAmount || 0;
    taxByRate[rate].sgst += item.sgstAmount || 0;
    taxByRate[rate].igst += item.igstAmount || 0;
  }

  const rates = Object.keys(taxByRate).map(Number).sort((a, b) => a - b);
  for (const rate of rates) {
    const t = taxByRate[rate];
    if (isInterState) {
      p.leftRight(`  IGST @ ${rate}%:`, t.igst.toFixed(2));
    } else {
      const halfRate = rate / 2;
      p.leftRight(`  CGST @ ${halfRate}%:`, t.cgst.toFixed(2));
      p.leftRight(`  SGST @ ${halfRate}%:`, t.sgst.toFixed(2));
    }
  }

  // Round off
  if (data.roundOffAmount && Math.abs(data.roundOffAmount) > 0.001) {
    const roStr =
      data.roundOffAmount > 0
        ? `+${data.roundOffAmount.toFixed(2)}`
        : data.roundOffAmount.toFixed(2);
    p.leftRight("Round Off:", roStr);
  }

  // ═══ TOTAL (double-height bold) ════════════════════════
  p.printDoubleLine();
  p.alignCenter();
  p.bold(true);
  p.doubleHeight(true);
  p.println(`TOTAL: Rs ${data.total.toFixed(2)}`);
  p.setNormal();
  p.bold(false);
  p.printDoubleLine();

  // ═══ PAYMENTS ══════════════════════════════════════════
  p.alignLeft();
  for (const pay of data.payments) {
    p.leftRight(`${pay.method}:`, pay.amount.toFixed(2));
  }
  if (data.change > 0) {
    p.leftRight("Change:", data.change.toFixed(2));
  }

  p.drawLine();

  // ═══ UPI QR CODE ═══════════════════════════════════════
  if (data.upiPaymentLink) {
    p.alignCenter();
    p.println("Scan to Pay via UPI");
    p.printQR(data.upiPaymentLink, 5);
    p.newLine();
  } else if (data.qrCodeText) {
    p.alignCenter();
    p.printQR(data.qrCodeText, 5);
    p.newLine();
  }

  p.drawLine();

  // ═══ FOOTER ════════════════════════════════════════════
  p.alignCenter();
  p.println("Thank you! Visit again");

  if (data.fssaiNumber) {
    p.println(`FSSAI Lic: ${data.fssaiNumber}`);
  }

  p.printDoubleLine();
  p.newLine();
  p.newLine();

  if (options?.cutPaper !== false) {
    p.partialCut();
  }

  if (options?.openDrawer) {
    p.openCashDrawer();
  }

  return p.toUint8Array();
}
