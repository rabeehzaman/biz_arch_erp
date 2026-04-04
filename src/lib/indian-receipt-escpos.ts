/**
 * indian-receipt-escpos.ts — Indian GST receipt layout for browser/Capacitor.
 *
 * Mirrors the layout from electron/printer-service.js buildIndianGSTReceiptBuffer()
 * but uses the portable EscPosTextBuilder instead of node-thermal-printer.
 */

import { EscPosTextBuilder } from "@/lib/escpos-text-builder";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MappedData = Record<string, any>;

export function buildIndianGSTReceiptEscPos(
  data: MappedData,
  options?: { paperWidth?: 48 | 32; cutPaper?: boolean; openDrawer?: boolean },
): Uint8Array {
  const gst = data.gst || {};
  const p = new EscPosTextBuilder(options?.paperWidth ?? 48);

  p.init();

  // ═══ STORE HEADER ═══════════════════════════════════════
  p.printDoubleLine();
  p.alignCenter();
  p.bold(true);
  p.doubleHeight(true);
  p.println(data.header?.storeName || "STORE");
  p.setNormal();
  p.bold(false);
  p.printDoubleLine();

  p.alignCenter();
  if (data.header?.address) p.println(data.header.address);
  if (data.header?.phone) p.println(`Tel: ${data.header.phone}`);

  p.drawLine();

  // GSTIN
  const gstin = data.header?.vatNumber;
  if (gstin) {
    p.alignCenter();
    p.bold(true);
    p.println(`GSTIN: ${gstin}`);
    p.bold(false);
  }

  p.drawLine();

  // ═══ TAX INVOICE / BILL OF SUPPLY ══════════════════════
  const hasTax = (gst.totalCgst || 0) + (gst.totalSgst || 0) + (gst.totalIgst || 0) > 0;
  const docLabel = hasTax ? "TAX INVOICE" : "BILL OF SUPPLY";

  p.alignCenter();
  p.printBoxFrame(docLabel);

  p.drawLine();

  // ═══ INVOICE INFO ══════════════════════════════════════
  p.alignLeft();
  if (data.invoiceNo) p.println(`Invoice: ${data.invoiceNo}`);
  if (data.date) p.println(`Date: ${data.date}`);
  if (data.cashier) p.println(`Cashier: ${data.cashier}`);
  if (data.customerName) p.println(`Customer: ${data.customerName}`);

  if (gst.placeOfSupplyName || gst.placeOfSupply) {
    const posText =
      gst.placeOfSupply && gst.placeOfSupplyName
        ? `${gst.placeOfSupply} - ${gst.placeOfSupplyName}`
        : gst.placeOfSupplyName || gst.placeOfSupply;
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
  if (Array.isArray(data.items)) {
    for (const item of data.items) {
      const lineTotal = (
        item.total !== undefined
          ? item.total
          : (item.qty || 1) * (item.price || 0)
      ).toFixed(2);

      p.bold(true);
      p.println(item.name || "");
      p.bold(false);

      const hsnPart = item.hsnCode ? `HSN:${item.hsnCode}` : "";
      const qtyPart = `${item.qty || 1} x ${(item.price || 0).toFixed(2)}`;
      const detailLeft = [hsnPart, qtyPart].filter(Boolean).join("  ");
      p.leftRight(`  ${detailLeft}`, lineTotal);

      const gstRate = item.gstRate || 0;
      if (gstRate > 0) {
        let gstDetail: string;
        if (gst.isInterState) {
          gstDetail = `GST ${gstRate}% (IGST ${gstRate}%)`;
        } else {
          const halfRate = gstRate / 2;
          gstDetail = `GST ${gstRate}% (CGST ${halfRate}%+SGST ${halfRate}%)`;
        }
        p.println(`  ${gstDetail}`);
      }
    }
  }

  p.drawLine();

  // ═══ TOTALS ════════════════════════════════════════════
  if (data.totals) {
    if (data.totals.subtotal !== undefined) {
      p.leftRight("Subtotal:", data.totals.subtotal.toFixed(2));
    }
    if (data.totals.discount) {
      p.leftRight("Discount:", `-${data.totals.discount.toFixed(2)}`);
    }
  }

  // GST grouped by rate
  if (Array.isArray(data.items)) {
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
      if (gst.isInterState) {
        p.leftRight(`  IGST @ ${rate}%:`, t.igst.toFixed(2));
      } else {
        const halfRate = rate / 2;
        p.leftRight(`  CGST @ ${halfRate}%:`, t.cgst.toFixed(2));
        p.leftRight(`  SGST @ ${halfRate}%:`, t.sgst.toFixed(2));
      }
    }
  }

  // Round off
  if (data.totals?.roundOff && Math.abs(data.totals.roundOff) > 0.001) {
    const roStr =
      data.totals.roundOff > 0
        ? `+${data.totals.roundOff.toFixed(2)}`
        : data.totals.roundOff.toFixed(2);
    p.leftRight("Round Off:", roStr);
  }

  // ═══ TOTAL (double-height bold) ════════════════════════
  p.printDoubleLine();
  p.alignCenter();
  p.bold(true);
  p.doubleHeight(true);
  p.println(`TOTAL: Rs ${(data.totals?.total || 0).toFixed(2)}`);
  p.setNormal();
  p.bold(false);
  p.printDoubleLine();

  // ═══ PAYMENTS ══════════════════════════════════════════
  p.alignLeft();
  if (data.payment) {
    if (Array.isArray(data.payment)) {
      for (const pay of data.payment) {
        p.leftRight(`${pay.method}:`, pay.amount.toFixed(2));
      }
    }
    if (data.change && data.change > 0) {
      p.leftRight("Change:", data.change.toFixed(2));
    }
  }

  p.drawLine();

  // ═══ UPI QR CODE ═══════════════════════════════════════
  const upiLink = gst.upiPaymentLink;
  if (upiLink) {
    p.alignCenter();
    p.println("Scan to Pay via UPI");
    p.printQR(upiLink, 5);
    p.newLine();
  } else {
    const qrValue =
      typeof data.qrcode === "string" && !data.qrcode.startsWith("data:")
        ? data.qrcode
        : typeof data.qrCodeText === "string"
          ? data.qrCodeText
          : null;
    if (qrValue) {
      p.alignCenter();
      p.printQR(qrValue, 5);
      p.newLine();
    }
  }

  p.drawLine();

  // ═══ FOOTER ════════════════════════════════════════════
  p.alignCenter();
  p.println("Thank you! Visit again");

  if (gst.fssaiNumber) {
    p.println(`FSSAI Lic: ${gst.fssaiNumber}`);
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
