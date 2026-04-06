/* eslint-disable @next/next/no-img-element */
import React from "react";
import { format } from "date-fns";
import { getLocaleForCurrency, getCurrencySymbol } from "@/lib/currency";

export interface InvoiceReceiptItem {
  name: string;
  nameSecondary?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

export interface InvoiceReceiptPayment {
  date: Date;
  method: string;
  amount: number;
  reference?: string | null;
}

export interface InvoiceReceiptData {
  // Store/Org header
  storeName: string;
  storeAddress?: string;
  storeCity?: string;
  storeState?: string;
  storePhone?: string;
  vatNumber?: string;
  secondaryName?: string;
  logoUrl?: string;
  logoHeight?: number;
  brandColor?: string;
  currency?: string;

  // Invoice identification
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  paymentType?: string;
  saudiInvoiceType?: string; // "STANDARD" | "SIMPLIFIED"

  // Bill To (customer)
  customerName: string;
  customerSecondaryName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerCity?: string;
  customerState?: string;
  customerZipCode?: string;
  customerVatNumber?: string;

  // Line items
  items: InvoiceReceiptItem[];

  // Totals
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  roundOffAmount?: number;
  total: number;
  isTaxInclusivePrice?: boolean;

  // Payment tracking
  amountPaid: number;
  balanceDue: number;
  isOverdue: boolean;

  // Payment history
  payments: InvoiceReceiptPayment[];

  // Notes / Terms
  notes?: string;
  terms?: string;

  // QR Code (ZATCA)
  qrCodeDataURL?: string;
}

// Payment method Arabic translations
const PAYMENT_AR: Record<string, string> = {
  CASH: "نقداً",
  BANK_TRANSFER: "تحويل بنكي",
  CREDIT_CARD: "بطاقة ائتمان",
  CHECK: "شيك",
  UPI: "UPI",
  OTHER: "أخرى",
};

const formatCurrency = (amount: number, currency?: string) => {
  const locale = getLocaleForCurrency(currency || "SAR");
  return amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export function InvoiceReceipt({ data }: { data: InvoiceReceiptData }) {
  const cur = data.currency || "SAR";

  // Bilingual label helper — "English / عربي"
  const bl = (en: string, ar: string) => `${en} / ${ar}`;

  const containerStyle: React.CSSProperties = {
    width: "100%",
    fontFamily: "'Arial', 'Noto Sans Arabic', sans-serif",
    fontSize: "13px",
    lineHeight: "1.5",
    color: "#000",
    padding: "0 0 3mm 0",
  };

  const centerStyle: React.CSSProperties = { textAlign: "center" };
  const rowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "baseline" };

  const accentDivider: React.CSSProperties = {
    height: "2px",
    background: "#000",
    margin: "8px 0",
    border: "none",
  };

  const thinDivider: React.CSSProperties = {
    height: "1px",
    background: "#000",
    margin: "6px 0",
    border: "none",
  };

  const dottedDivider: React.CSSProperties = {
    borderTop: "1px dashed #000",
    margin: "6px 0",
  };

  // Balance due styling — B&W compatible
  const getBalanceLabel = (): string => {
    if (data.balanceDue <= 0) return "مدفوعة / PAID";
    if (data.isOverdue) return "متأخر / OVERDUE";
    return "مستحق / DUE";
  };

  // Invoice type label
  const invoiceTypeLabel = data.saudiInvoiceType === "STANDARD"
    ? { ar: "فاتورة ضريبية", en: "Tax Invoice" }
    : { ar: "فاتورة ضريبية مبسطة", en: "Simplified Tax Invoice" };

  return (
    <div style={containerStyle}>
      {/* 1. Logo */}
      {data.logoUrl && (
        <div style={{ ...centerStyle, marginBottom: "6px" }}>
          <img
            src={data.logoUrl}
            alt="Logo"
            style={{
              maxHeight: `${data.logoHeight ?? 80}px`,
              maxWidth: "55mm",
              objectFit: "contain",
              display: "inline-block",
            }}
          />
        </div>
      )}

      {/* 2. Invoice Type Label */}
      <div style={{
        ...centerStyle,
        fontSize: "12px",
        fontWeight: 700,
        marginBottom: "4px",
        color: "#000",
      }}>
        <div>{invoiceTypeLabel.ar}</div>
        <div style={{ fontSize: "10px", fontWeight: 600, color: "#000" }}>{invoiceTypeLabel.en}</div>
      </div>

      {/* 3. Store Header */}
      <div style={centerStyle}>
        {data.secondaryName && (
          <div style={{
            fontSize: "15px",
            fontWeight: 800,
            direction: "rtl",
            marginBottom: "2px",
            color: "#000",
          }}>
            {data.secondaryName}
          </div>
        )}
        <div style={{
          fontWeight: 800,
          fontSize: "14px",
          letterSpacing: "0.5px",
          color: "#000",
        }}>
          {data.storeName || "Store"}
        </div>
        {data.storeAddress && (
          <div style={{ fontSize: "11px", fontWeight: 500, color: "#000", marginTop: "2px" }}>{data.storeAddress}</div>
        )}
        {(data.storeCity || data.storeState) && (
          <div style={{ fontSize: "11px", fontWeight: 500, color: "#000" }}>
            {[data.storeCity, data.storeState].filter(Boolean).join(", ")}
          </div>
        )}
        {data.storePhone && (
          <div style={{ fontSize: "11px", fontWeight: 500, color: "#000" }}>
            هاتف / Tel: {data.storePhone}
          </div>
        )}
        {data.vatNumber && (
          <div style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "#000",
            marginTop: "3px",
            padding: "2px 8px",
            border: "1px solid #000",
            borderRadius: "3px",
            display: "inline-block",
          }}>
            الرقم الضريبي / VAT No: {data.vatNumber}
          </div>
        )}
      </div>

      {/* 4. Accent Divider */}
      <div style={accentDivider} />

      {/* 5. Invoice Info */}
      <div style={{ padding: "0 1px" }}>
        <div style={{ ...rowStyle, fontWeight: 700, fontSize: "12px" }}>
          <span>رقم الفاتورة / #{data.invoiceNumber}</span>
          <span>{format(data.issueDate, "dd MMM yyyy")}</span>
        </div>
        <div style={{ ...rowStyle, fontSize: "11px", color: "#000", marginTop: "2px" }}>
          <span>{bl("Issue Date", "تاريخ الإصدار")}</span>
          <span>{format(data.issueDate, "dd/MM/yyyy")}</span>
        </div>
        <div style={{ ...rowStyle, fontSize: "11px", color: "#000", marginTop: "1px" }}>
          <span>{bl("Due Date", "تاريخ الاستحقاق")}</span>
          <span>{format(data.dueDate, "dd/MM/yyyy")}</span>
        </div>
        {data.paymentType && (
          <div style={{ ...rowStyle, fontSize: "11px", color: "#000", marginTop: "1px" }}>
            <span>{bl("Payment Type", "نوع الدفع")}</span>
            <span>{data.paymentType === "CASH" ? "نقدي / Cash" : "آجل / Credit"}</span>
          </div>
        )}
      </div>

      {/* Thin Divider */}
      <div style={thinDivider} />

      {/* 6. Bill To Box */}
      <div style={{
        padding: "6px 8px",
        borderRadius: "4px",
        border: "1px solid #000",
        marginBottom: "4px",
      }}>
        <div style={{
          fontSize: "10px",
          fontWeight: 700,
          color: "#000",
          letterSpacing: "0.3px",
          marginBottom: "4px",
          textTransform: "none",
        }}>
          فاتورة إلى / Bill To
        </div>
        {data.customerSecondaryName && (
          <div style={{ fontSize: "13px", fontWeight: 700, direction: "rtl", color: "#000" }}>
            {data.customerSecondaryName}
          </div>
        )}
        <div style={{ fontSize: "12px", fontWeight: 600, color: "#000" }}>
          {data.customerName}
        </div>
        {data.customerPhone && (
          <div style={{ fontSize: "11px", color: "#000", marginTop: "2px" }}>
            هاتف / Phone: {data.customerPhone}
          </div>
        )}
        {data.customerEmail && (
          <div style={{ fontSize: "11px", color: "#000", marginTop: "1px" }}>
            بريد / Email: {data.customerEmail}
          </div>
        )}
        {(data.customerAddress || data.customerCity || data.customerState) && (
          <div style={{ fontSize: "11px", color: "#000", marginTop: "1px" }}>
            {[data.customerAddress, data.customerCity, data.customerState, data.customerZipCode].filter(Boolean).join(", ")}
          </div>
        )}
        {data.customerVatNumber && (
          <div style={{
            fontSize: "10px",
            fontWeight: 700,
            color: "#000",
            marginTop: "4px",
            padding: "2px 6px",
            border: "1px solid #000",
            borderRadius: "3px",
            display: "inline-block",
          }}>
            الرقم الضريبي للعميل / Customer VAT No: {data.customerVatNumber}
          </div>
        )}
      </div>

      {/* 7. Thin Divider */}
      <div style={thinDivider} />

      {/* 8. Column Headers */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: "10px",
        fontWeight: 700,
        color: "#000",
        letterSpacing: "0.3px",
        padding: "0 1px",
        marginBottom: "4px",
      }}>
        <span style={{ flex: 1 }}>{bl("Item", "الصنف")}</span>
        <span style={{ width: "45px", textAlign: "center" }}>{bl("Qty", "الكمية")}</span>
        <span style={{ width: "55px", textAlign: "right" }}>{bl("Price", "السعر")}</span>
        <span style={{ width: "60px", textAlign: "right" }}>{bl("Total", "الإجمالي")}</span>
      </div>

      {/* Items */}
      <div style={{ padding: "0 1px" }}>
        {data.items.map((item, i) => (
          <div key={i} style={{
            paddingBottom: "4px",
            marginBottom: "4px",
            borderBottom: i < data.items.length - 1 ? "1px dotted #000" : "none",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span style={{ flex: 1, fontSize: "12px", fontWeight: 600, paddingRight: "4px" }}>
                {item.name}
              </span>
              <span style={{ width: "45px", textAlign: "center", fontSize: "11px", color: "#000" }}>
                {item.quantity}
              </span>
              <span style={{ width: "55px", textAlign: "right", fontSize: "11px", color: "#000" }}>
                {formatCurrency(item.unitPrice, cur)}
              </span>
              <span style={{ width: "60px", textAlign: "right", fontSize: "12px", fontWeight: 700 }}>
                {formatCurrency(item.lineTotal, cur)}
              </span>
            </div>
            {item.discount > 0 && (
              <div style={{ fontSize: "10px", color: "#000", marginTop: "1px" }}>
                خصم / Disc: {item.discount}%
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 9. Dotted Divider */}
      <div style={dottedDivider} />

      {/* 10. Totals */}
      <div style={{ padding: "0 1px" }}>
        <div style={{ ...rowStyle, fontSize: "12px", color: "#000" }}>
          <span>{bl("Subtotal", "المجموع الفرعي")}</span>
          <span>{formatCurrency(data.subtotal, cur)}</span>
        </div>
        {data.taxAmount > 0 && (
          <div style={{ ...rowStyle, fontSize: "12px", color: "#000", marginTop: "2px" }}>
            <span>
              ضريبة القيمة المضافة / VAT {data.taxRate > 0 ? `(${data.taxRate}%)` : "(15%)"}
              {data.isTaxInclusivePrice ? " (incl.)" : ""}
            </span>
            <span>{formatCurrency(data.taxAmount, cur)}</span>
          </div>
        )}
        {data.isTaxInclusivePrice && (
          <div style={{ fontSize: "10px", color: "#000", textAlign: "center", marginTop: "2px" }}>
            الأسعار شاملة الضريبة / Prices include tax
          </div>
        )}
        {data.roundOffAmount !== undefined && data.roundOffAmount !== 0 && (
          <div style={{ ...rowStyle, fontSize: "12px", color: "#000", marginTop: "2px" }}>
            <span>{bl("Round Off", "التقريب")}</span>
            <span>
              {data.roundOffAmount > 0 ? "+" : ""}
              {formatCurrency(data.roundOffAmount, cur)}
            </span>
          </div>
        )}
        <div style={{
          ...rowStyle,
          fontWeight: 800,
          fontSize: "15px",
          marginTop: "3px",
          padding: "4px 8px",
          border: "2px solid #000",
          color: "#000",
          borderRadius: "4px",
        }}>
          <span>{bl("TOTAL", "الإجمالي")}</span>
          <span>{getCurrencySymbol(cur)}{formatCurrency(data.total, cur)}</span>
        </div>
      </div>

      {/* 11. Thin Divider */}
      <div style={thinDivider} />

      {/* 12. Payment Summary */}
      <div style={{ padding: "0 1px" }}>
        <div style={{ ...rowStyle, fontSize: "12px", color: "#000" }}>
          <span>{bl("Amount Paid", "المبلغ المدفوع")}</span>
          <span style={{ fontWeight: 600 }}>{formatCurrency(data.amountPaid, cur)}</span>
        </div>
        <div style={{
          ...rowStyle,
          fontSize: "12px",
          fontWeight: 700,
          marginTop: "4px",
          padding: "4px 8px",
          color: "#000",
          borderRadius: "4px",
          border: "1px solid #000",
        }}>
          <span>{bl("Balance Due", "الرصيد المستحق")}</span>
          <span>
            {formatCurrency(Math.abs(data.balanceDue), cur)}
            <span style={{ fontSize: "9px", marginLeft: "4px" }}>{getBalanceLabel()}</span>
          </span>
        </div>
      </div>

      {/* 13. Payment History */}
      {data.payments.length > 0 && (
        <>
          <div style={dottedDivider} />
          <div style={{ padding: "0 1px" }}>
            <div style={{
              fontSize: "10px",
              fontWeight: 700,
              color: "#000",
              letterSpacing: "0.3px",
              marginBottom: "3px",
            }}>
              سجل المدفوعات / Payment History
            </div>
            {data.payments.map((p, i) => {
              const arMethod = PAYMENT_AR[p.method] || p.method;
              return (
                <div key={i} style={{ ...rowStyle, fontSize: "11px", marginBottom: "2px" }}>
                  <span style={{ color: "#000", flex: 1 }}>
                    {format(p.date, "dd/MM/yy")} — {arMethod} / {p.method}
                  </span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(p.amount, cur)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 14. Notes / Terms */}
      {(data.notes || data.terms) && (
        <>
          <div style={thinDivider} />
          <div style={{ padding: "0 1px" }}>
            {data.notes && (
              <div style={{ fontSize: "10px", color: "#000", marginBottom: "2px" }}>
                <span style={{ fontWeight: 700 }}>ملاحظات / Notes: </span>
                <span style={{ fontStyle: "italic" }}>{data.notes}</span>
              </div>
            )}
            {data.terms && (
              <div style={{ fontSize: "10px", color: "#000" }}>
                <span style={{ fontWeight: 700 }}>الشروط / Terms: </span>
                <span style={{ fontStyle: "italic" }}>{data.terms}</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* 15. Accent Divider */}
      <div style={accentDivider} />

      {/* 16. QR Code */}
      {data.qrCodeDataURL && (
        <div style={{
          ...centerStyle,
          margin: "4px 0",
          padding: "8px",
          border: "1px solid #000",
          borderRadius: "6px",
        }}>
          <img
            src={data.qrCodeDataURL}
            alt="ZATCA QR"
            style={{
              width: "120px",
              height: "120px",
              display: "inline-block",
              imageRendering: "pixelated",
            }}
          />
          <div style={{
            fontSize: "9px",
            color: "#000",
            marginTop: "4px",
            letterSpacing: "0.5px",
          }}>
            مسح للتحقق - هيئة الزكاة والضريبة والجمارك
          </div>
          <div style={{ fontSize: "8px", color: "#000", marginTop: "1px" }}>
            Scan to Verify - ZATCA Compliant
          </div>
        </div>
      )}

      {/* 17. Footer */}
      <div style={{
        ...centerStyle,
        marginTop: "8px",
        fontSize: "11px",
        color: "#000",
      }}>
        <div style={{ fontWeight: 600, direction: "rtl" }}>شكراً لزيارتكم</div>
        <div style={{ fontSize: "10px" }}>Thank you for your visit!</div>
      </div>
    </div>
  );
}
