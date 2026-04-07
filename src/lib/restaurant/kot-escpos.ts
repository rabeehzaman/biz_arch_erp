/**
 * kot-escpos.ts — KOT (Kitchen Order Ticket) ESC/POS text formatter.
 *
 * Builds raw ESC/POS byte commands for KOT printing on thermal printers.
 * Uses the portable EscPosTextBuilder (no Node.js dependencies).
 * Designed for maximum visual impact — bold, double-height, double-size,
 * inverse colors, box frames, and underlines for quick kitchen readability.
 */

import type { KOTReceiptData } from "@/components/restaurant/kot-receipt";
import { EscPosTextBuilder } from "@/lib/escpos-text-builder";
import { format } from "date-fns";

const KOT_TYPE_LABELS: Record<KOTReceiptData["kotType"], string> = {
  STANDARD: "NEW ORDER",
  FOLLOWUP: "FOLLOW-UP",
  VOID: "VOID / CANCELLED",
};

/**
 * Word-wrap text to fit within a given character width.
 * Splits on word boundaries; words longer than maxWidth are force-broken.
 */
function wordWrap(text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const words = text.split(/\s+/);
  let current = "";

  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= maxWidth) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) lines.push(current);

  // Force-break any line still longer than maxWidth
  const result: string[] = [];
  for (const line of lines) {
    if (line.length <= maxWidth) {
      result.push(line);
    } else {
      for (let i = 0; i < line.length; i += maxWidth) {
        result.push(line.substring(i, i + maxWidth));
      }
    }
  }

  return result;
}

export function buildKotEscPos(
  data: KOTReceiptData,
  options?: { paperWidth?: 48 | 32; cutPaper?: boolean },
): Uint8Array {
  const pw = options?.paperWidth ?? 48;
  const p = new EscPosTextBuilder(pw);
  const isVoid = data.kotType === "VOID";
  const typeLabel = KOT_TYPE_LABELS[data.kotType];

  p.init();

  // ═══ REPRINT BANNER ═══════════════════════════════════════
  if (data.isReprint) {
    p.alignCenter();
    p.inverseColors(true);
    p.bold(true);
    p.println("                                                ");
    p.println("          ** REPRINT **          ");
    p.println("                                                ");
    p.inverseColors(false);
    p.bold(false);
    p.newLine();
  }

  // ═══ HEADER ═══════════════════════════════════════════════
  p.printDoubleLine();
  p.alignCenter();
  p.bold(true);
  p.doubleHeight(true);
  p.println("KITCHEN ORDER TICKET");
  p.setNormal();
  p.bold(false);

  // ═══ KOT NUMBER — biggest text on the ticket ══════════════
  p.alignCenter();
  p.bold(true);
  p.doubleSize(true);
  p.println(`#${data.kotNumber}`);
  p.setNormal();
  p.bold(false);
  p.printDoubleLine();

  // ═══ STATION NAME (multi-printer routing) ══════════════════
  if (data.stationName) {
    p.alignCenter();
    p.inverseColors(true);
    p.bold(true);
    p.doubleHeight(true);
    p.println(` ${data.stationName.toUpperCase()} `);
    p.setNormal();
    p.bold(false);
    p.inverseColors(false);
    p.newLine();
  }

  // ═══ TYPE LABEL ════════════════════════════════════════════
  if (isVoid) {
    // VOID: inverse (white-on-black) + double-height — unmissable
    p.alignCenter();
    p.inverseColors(true);
    p.bold(true);
    p.doubleHeight(true);
    p.println(` ${typeLabel} `);
    p.setNormal();
    p.bold(false);
    p.inverseColors(false);
  } else {
    // NEW ORDER / FOLLOW-UP: box frame
    p.alignCenter();
    p.printBoxFrame(typeLabel);
  }

  p.drawLine();

  // ═══ ORDER INFO ════════════════════════════════════════════
  const orderTypeStr = data.orderType === "DINE_IN" ? "DINE-IN" : "TAKEAWAY";
  const timeStr = format(data.timestamp, "hh:mm a");

  p.bold(true);
  p.leftRight(orderTypeStr, timeStr);
  p.bold(false);

  // Table info (DINE_IN only)
  if (data.orderType === "DINE_IN" && (data.tableName || data.tableNumber)) {
    const tableName = data.tableName || `#${data.tableNumber}`;
    p.bold(true);
    p.doubleHeight(true);
    p.alignLeft();
    p.println(`Table: ${tableName}`);
    p.setNormal();
    p.bold(false);

    if (data.section) {
      p.alignLeft();
      p.println(`  (${data.section})`);
    }
  }

  // Server
  if (data.serverName) {
    p.bold(true);
    p.println(`Server: ${data.serverName}`);
    p.bold(false);
  }

  // Date
  p.println(format(data.timestamp, "dd MMM yyyy"));

  p.drawLine();

  // ═══ COLUMN HEADERS ════════════════════════════════════════
  p.bold(true);
  p.underline(true);
  p.tableCustom([
    { text: "QTY", align: "LEFT", width: 0.15 },
    { text: "ITEM", align: "LEFT", width: 0.85 },
  ]);
  p.underline(false);
  p.bold(false);

  // ═══ ITEMS ═════════════════════════════════════════════════
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];

    // Quantity + Item name — double-height bold for kitchen readability
    let namePart = item.name;
    if (item.isNew) namePart += " [NEW]";

    p.bold(true);
    p.doubleHeight(true);

    if (isVoid) {
      // VOID items: inverse prefix
      p.alignLeft();
      p.inverseColors(true);
      p.println(` [VOID] `);
      p.inverseColors(false);
      p.println(`${item.quantity}x ${namePart}`);
    } else {
      p.println(`${item.quantity}x ${namePart}`);
    }

    p.setNormal();
    p.bold(false);

    // Modifiers — bold, indented with >> prefix
    if (item.modifiers && item.modifiers.length > 0) {
      p.bold(true);
      for (const mod of item.modifiers) {
        p.println(`   >> ${mod}`);
      }
      p.bold(false);
    }

    // Notes — indented with * prefix
    if (item.notes) {
      p.println(`   * ${item.notes}`);
    }

    // Dotted divider between items (not after last)
    if (i < data.items.length - 1) {
      p.drawLine(".");
    }
  }

  // ═══ SPECIAL INSTRUCTIONS ══════════════════════════════════
  if (data.specialInstructions) {
    p.printDoubleLine();
    p.alignCenter();
    p.bold(true);
    p.underline(true);
    p.println("SPECIAL INSTRUCTIONS");
    p.underline(false);
    p.alignLeft();

    // Word-wrap instructions to fit paper width
    const wrapped = wordWrap(data.specialInstructions, pw);
    for (const line of wrapped) {
      p.println(line);
    }

    p.bold(false);
    p.printDoubleLine();
  }

  p.drawLine();

  // ═══ FOOTER SUMMARY ════════════════════════════════════════
  const totalItems = data.items.length;
  const totalQty = data.items.reduce((sum, item) => sum + item.quantity, 0);

  p.alignCenter();
  p.bold(true);
  p.println(`Items: ${totalItems} | Total Qty: ${totalQty}`);
  p.bold(false);

  p.newLine();
  p.newLine();

  // ═══ PAPER CUT ═════════════════════════════════════════════
  if (options?.cutPaper !== false) {
    p.partialCut();
  }

  return p.toUint8Array();
}
