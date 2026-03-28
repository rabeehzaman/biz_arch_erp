/**
 * receipt-bitmap-layout.ts — Translates ReceiptData into canvas drawing
 * instructions on a ReceiptBitmapBuilder.
 *
 * The layout mirrors the PosReceipt React component (src/components/pos/receipt.tsx)
 * but draws directly onto a Canvas for crisp Arabic text and fast output.
 *
 * The ZATCA QR code is intentionally EXCLUDED from the bitmap — it is sent
 * separately as a native ESC/POS GS ( k command for maximum speed and sharpness.
 */

import { format } from "date-fns";
import { getLocaleForCurrency, getCurrencySymbol } from "@/lib/currency";
import type { ReceiptData } from "@/components/pos/receipt";
import { createReceiptBitmapBuilder, type ReceiptBitmapBuilder } from "@/lib/receipt-bitmap-builder";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PAYMENT_AR: Record<string, string> = {
  CASH: "نقداً",
  BANK_TRANSFER: "تحويل بنكي",
  CREDIT_CARD: "بطاقة ائتمان",
  CHECK: "شيك",
  UPI: "UPI",
  OTHER: "أخرى",
};

function fmt(amount: number, currency?: string): string {
  const locale = getLocaleForCurrency(currency || "INR");
  return amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------------
// Main layout function
// ---------------------------------------------------------------------------

export interface BuildReceiptBitmapOptions {
  paperWidth?: 58 | 80;
  marginLeft?: number;  // mm
  marginRight?: number; // mm
}

/**
 * Build a receipt bitmap from ReceiptData.
 * Returns a ReceiptBitmapBuilder with the receipt drawn on it.
 * The QR code is NOT included — use the qrCodeText field separately with
 * buildNativeQRCommand() for the printer's native QR generation.
 */
export async function buildReceiptBitmap(
  data: ReceiptData,
  options?: BuildReceiptBitmapOptions,
): Promise<ReceiptBitmapBuilder> {
  const builder = createReceiptBitmapBuilder({
    paperWidth: options?.paperWidth ?? 80,
    marginLeft: options?.marginLeft,
    marginRight: options?.marginRight,
  });

  const color = data.brandColor || "#1a1a2e";
  const cur = data.currency;
  const taxLbl = data.taxLabel || (data.storeGstin ? "GST" : "Tax");
  const displayVat = data.vatNumber || data.storeGstin;
  const isZatca = taxLbl === "VAT" && !!data.arabicName;

  const bl = (en: string, ar: string) => (isZatca ? `${en} / ${ar}` : en);

  // ── Logo ──────────────────────────────────────────────────────
  if (data.logoUrl) {
    const maxH = data.logoHeight ?? 80;
    await builder.drawImage(data.logoUrl, builder.contentWidth * 0.7, maxH);
  }

  // ── Return / Credit Note Banner ───────────────────────────────
  if (data.isReturn) {
    if (isZatca) {
      builder.drawCenteredText("إشعار دائن / مرتجع", 14, 800, { rtl: true, color: "#e74c3c" });
      builder.drawCenteredText("CREDIT NOTE / RETURN", 11, 700, { color: "#e74c3c" });
    } else {
      builder.drawCenteredText("CREDIT NOTE / RETURN", 14, 800, { color: "#e74c3c" });
    }
    builder.advance(4);
  }

  // ── ZATCA Invoice Type Label ──────────────────────────────────
  if (isZatca && !data.isReturn) {
    builder.drawCenteredText("فاتورة ضريبية مبسطة", 12, 700, { rtl: true });
    builder.drawCenteredText("Simplified Tax Invoice", 10, 600);
    builder.advance(4);
  }

  // ── Store Header ──────────────────────────────────────────────
  if (data.arabicName) {
    builder.drawCenteredText(data.arabicName, 15, 800, { rtl: true });
  }
  builder.drawCenteredText(
    data.storeName || "Store",
    isZatca ? 14 : 16,
    800,
  );
  if (data.storeAddress) {
    builder.drawCenteredText(data.storeAddress, 11, 500);
  }
  if (data.storeCity || data.storeState) {
    const cityState = [data.storeCity, data.storeState].filter(Boolean).join(", ");
    builder.drawCenteredText(cityState, 11, 500);
  }
  if (data.storePhone) {
    const phone = isZatca ? `هاتف / Tel: ${data.storePhone}` : `Tel: ${data.storePhone}`;
    builder.drawCenteredText(phone, 11, 500, { rtl: isZatca });
  }
  if (displayVat) {
    const vatText = isZatca
      ? `الرقم الضريبي / VAT No: ${displayVat}`
      : `${taxLbl === "VAT" ? "VAT No" : "GSTIN"}: ${displayVat}`;

    // Draw a background pill for the VAT number
    const vatFontSize = 11;
    const vatWidth = builder.measureText(vatText, vatFontSize, 700) + 16;
    const pillX = builder.contentLeft + (builder.contentWidth - vatWidth) / 2;
    builder.drawRoundedFilledRect(pillX, builder.y, vatWidth, vatFontSize + 6, 3, "#f5f5f5");
    builder.advance(3);
    builder.drawCenteredText(vatText, vatFontSize, 700, { rtl: isZatca });
    builder.advance(2);
  }

  // ── Accent Divider ────────────────────────────────────────────
  builder.drawGradientLine(color);

  // ── Invoice Info ──────────────────────────────────────────────
  const invoiceNum = isZatca ? `رقم الفاتورة / #${data.invoiceNumber}` : `#${data.invoiceNumber}`;
  builder.drawLeftRightRow(
    invoiceNum,
    format(data.date, "dd MMM yyyy"),
    12,
    700,
    { leftRtl: isZatca },
  );

  if (data.customerName) {
    builder.drawLeftRightRow(
      `${bl("Customer", "العميل")}: ${data.customerName}`,
      format(data.date, "hh:mm a"),
      11,
      400,
    );
  } else {
    builder.drawRightText(format(data.date, "hh:mm a"), 11, 400);
  }

  // ── Thin Divider ──────────────────────────────────────────────
  builder.drawSolidLine("#dddddd");

  // ── Column Headers ────────────────────────────────────────────
  builder.drawTableRow(
    [
      { text: bl("Item", "الصنف"), widthFraction: 0.40, align: "left" },
      { text: bl("Qty", "الكمية"), widthFraction: 0.15, align: "center" },
      { text: bl("Price", "السعر"), widthFraction: 0.20, align: "right" },
      { text: bl("Total", "الإجمالي"), widthFraction: 0.25, align: "right" },
    ],
    10,
    700,
  );
  builder.advance(4);

  // ── Items ─────────────────────────────────────────────────────
  data.items.forEach((item, i) => {
    builder.drawTableRow(
      [
        { text: item.name, widthFraction: 0.40, align: "left" },
        { text: String(item.quantity), widthFraction: 0.15, align: "center" },
        { text: fmt(item.unitPrice, cur), widthFraction: 0.20, align: "right" },
        { text: fmt(item.lineTotal, cur), widthFraction: 0.25, align: "right" },
      ],
      12,
      600,
    );

    if (item.discount > 0) {
      const discText = isZatca ? `خصم / Disc: ${item.discount}%` : `Disc: ${item.discount}%`;
      builder.drawLeftText(discText, 10, 400, { color: "#e74c3c" });
    }

    if (i < data.items.length - 1) {
      builder.drawDottedLine("#eeeeee");
    }
  });

  // ── Dotted Divider ────────────────────────────────────────────
  builder.drawDashedLine("#cccccc");

  // ── Totals ────────────────────────────────────────────────────
  builder.drawLeftRightRow(
    bl("Subtotal", "المجموع الفرعي"),
    fmt(data.subtotal, cur),
    12,
    400,
  );

  if (data.taxAmount > 0) {
    const taxRate = data.taxRate > 0 ? ` (${data.taxRate}%)` : taxLbl === "VAT" ? " (15%)" : "";
    const taxText = isZatca
      ? `ضريبة القيمة المضافة / VAT${taxRate}`
      : `${taxLbl}${taxRate}`;
    const inclSuffix = data.isTaxInclusivePrice ? " (incl.)" : "";
    builder.drawLeftRightRow(
      `${taxText}${inclSuffix}`,
      fmt(data.taxAmount, cur),
      12,
      400,
    );
  }

  if (data.isTaxInclusivePrice) {
    const inclText = isZatca
      ? "الأسعار شاملة الضريبة / Prices include tax"
      : "Prices include tax";
    builder.drawCenteredText(inclText, 10, 400, { rtl: isZatca });
  }

  if (data.roundOffAmount !== undefined && data.roundOffAmount !== 0) {
    const sign = data.roundOffAmount > 0 ? "+" : "";
    builder.drawLeftRightRow(
      bl("Round Off", "التقريب"),
      `${sign}${fmt(data.roundOffAmount, cur)}`,
      12,
      400,
    );
  }

  // ── TOTAL (with colored background) ───────────────────────────
  builder.advance(3);
  const totalText = `${getCurrencySymbol(cur || "INR")}${fmt(data.total, cur)}`;
  const totalLabel = bl("TOTAL", "الإجمالي");
  const totalBarH = 26;
  builder.drawRoundedFilledRect(
    builder.contentLeft,
    builder.y,
    builder.contentWidth,
    totalBarH,
    4,
    color,
  );
  // Draw white text centered vertically inside the bar
  builder.advance(5);
  builder.drawLeftRightRow(totalLabel, totalText, 15, 800, { color: "#ffffff" });
  // Ensure cursor clears the bar
  builder.advance(2);

  // ── Thin Divider ──────────────────────────────────────────────
  builder.drawSolidLine("#dddddd");

  // ── Payments ──────────────────────────────────────────────────
  builder.drawLeftText(
    bl("Payment", "طريقة الدفع"),
    10,
    700,
  );
  builder.advance(3);

  for (const p of data.payments) {
    const arMethod = PAYMENT_AR[p.method] || p.method;
    const methodText = isZatca ? `${arMethod} / ${p.method}` : p.method;
    builder.drawLeftRightRow(methodText, fmt(p.amount, cur), 12, 500);
  }

  if (data.change > 0) {
    builder.advance(3);
    // Change row with light background
    const changeH = 18;
    builder.drawRoundedFilledRect(
      builder.contentLeft,
      builder.y,
      builder.contentWidth,
      changeH,
      3,
      "#f0fdf4",
    );
    builder.advance(2);
    builder.drawLeftRightRow(
      bl("Change", "الباقي"),
      fmt(data.change, cur),
      12,
      600,
    );
    builder.advance(changeH - 18);
  }

  // ── Accent Divider ────────────────────────────────────────────
  builder.drawGradientLine(color);

  // ── QR Code placeholder ───────────────────────────────────────
  // The actual QR code is sent as a native ESC/POS command (GS ( k)
  // which is appended after this bitmap. We draw a label here.
  if (data.qrCodeText || data.qrCodeDataURL) {
    builder.advance(4);
    if (isZatca) {
      builder.drawCenteredText(
        "مسح للتحقق - هيئة الزكاة والضريبة والجمارك",
        9,
        400,
        { rtl: true },
      );
      builder.drawCenteredText("Scan to Verify - ZATCA Compliant", 8, 400);
    } else {
      builder.drawCenteredText("ZATCA Compliant - Scan to Verify", 9, 400);
    }
    builder.advance(4);
  }

  // ── Footer ────────────────────────────────────────────────────
  builder.advance(8);
  if (data.isReturn) {
    if (isZatca) {
      builder.drawCenteredText("شكراً لكم — تم المرتجع", 11, 600, { rtl: true });
      builder.drawCenteredText("Return processed successfully", 10, 400);
    } else {
      builder.drawCenteredText("Return processed successfully", 11, 600);
    }
  } else if (isZatca) {
    builder.drawCenteredText("شكراً لزيارتكم", 11, 600, { rtl: true });
    builder.drawCenteredText("Thank you for your visit!", 10, 400);
  } else {
    builder.drawCenteredText("Thank you for your purchase!", 11, 600);
  }

  builder.advance(8);

  return builder;
}
