/* eslint-disable @next/next/no-img-element */
import React from "react";
import { format } from "date-fns";
import { getLocaleForCurrency } from "@/lib/currency";

export interface PreBillItem {
  name: string;
  nameAr?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  modifiers?: string[];
}

export interface PreBillReceiptData {
  // Store info
  storeName: string;
  storeAddress?: string;
  storeCity?: string;
  storeState?: string;
  storePhone?: string;
  logoUrl?: string;
  logoHeight?: number;
  brandColor?: string;
  vatNumber?: string;
  secondaryName?: string;
  currency?: string;
  taxLabel?: string;
  // Order context
  date: Date;
  tableName?: string;
  tableNumber?: number;
  section?: string;
  serverName?: string;
  orderType: "DINE_IN" | "TAKEAWAY";
  customerName?: string;
  // Items
  items: PreBillItem[];
  // Totals
  subtotal: number;
  taxAmount: number;
  roundOffAmount?: number;
  total: number;
  isTaxInclusivePrice?: boolean;
}

const formatCurrency = (amount: number, currency?: string) => {
  const locale = getLocaleForCurrency(currency || "INR");
  return amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export function PreBillReceipt({ data }: { data: PreBillReceiptData }) {
  const color = data.brandColor || "#1a1a2e";
  const cur = data.currency;
  const taxLbl = data.taxLabel || "Tax";
  const isZatca = taxLbl === "VAT" && !!data.secondaryName;

  const bl = (en: string, ar: string) => isZatca ? `${en} / ${ar}` : en;

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
    background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
    margin: "8px 0",
    border: "none",
  };

  const thinDivider: React.CSSProperties = {
    height: "1px",
    background: "#ddd",
    margin: "6px 0",
    border: "none",
  };

  return (
    <div style={containerStyle}>
      {/* Logo */}
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

      {/* Estimated Bill Label */}
      <div style={{
        ...centerStyle,
        fontSize: "14px",
        fontWeight: 800,
        marginBottom: "4px",
        padding: "4px 8px",
        border: `2px dashed ${color}`,
        borderRadius: "4px",
      }}>
        {isZatca ? (
          <>
            <div style={{ direction: "rtl" }}>فاتورة تقديرية</div>
            <div style={{ fontSize: "12px", fontWeight: 700 }}>ESTIMATED BILL</div>
          </>
        ) : (
          <div>ESTIMATED BILL</div>
        )}
      </div>

      {/* Store Header */}
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
          fontSize: isZatca ? "14px" : "16px",
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
            {isZatca ? "هاتف / " : ""}Tel: {data.storePhone}
          </div>
        )}
        {data.vatNumber && (
          <div style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "#000",
            marginTop: "3px",
            padding: "2px 8px",
            background: "#f5f5f5",
            borderRadius: "3px",
            display: "inline-block",
          }}>
            {isZatca
              ? `الرقم الضريبي / VAT No: ${data.vatNumber}`
              : `${taxLbl === "VAT" ? "VAT No" : taxLbl === "GST" ? "GSTIN" : "Tax ID"}: ${data.vatNumber}`
            }
          </div>
        )}
      </div>

      <div style={accentDivider} />

      {/* Order Info */}
      <div style={{ padding: "0 1px" }}>
        <div style={{ ...rowStyle, fontWeight: 700, fontSize: "12px" }}>
          <span>{data.orderType === "DINE_IN" ? bl("Dine-In", "تناول الطعام") : bl("Takeaway", "سفري")}</span>
          <span>{format(data.date, "dd MMM yyyy")}</span>
        </div>
        <div style={{ ...rowStyle, fontSize: "11px", color: "#000" }}>
          {data.orderType === "DINE_IN" && (data.tableName || data.tableNumber != null) ? (
            <span style={{ fontWeight: 700 }}>
              {bl("Table", "الطاولة")}: {data.tableName || `#${data.tableNumber}`}
              {data.section && <span style={{ fontWeight: 500 }}> ({data.section})</span>}
            </span>
          ) : (
            <span>&nbsp;</span>
          )}
          <span>{format(data.date, "hh:mm a")}</span>
        </div>
        {data.serverName && (
          <div style={{ fontSize: "11px" }}>
            {bl("Server", "النادل")}: {data.serverName}
          </div>
        )}
        {data.customerName && (
          <div style={{ fontSize: "11px" }}>
            {bl("Customer", "العميل")}: {data.customerName}
          </div>
        )}
      </div>

      <div style={thinDivider} />

      {/* Column Headers */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: "10px",
        fontWeight: 700,
        textTransform: isZatca ? "none" : "uppercase",
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
            borderBottom: i < data.items.length - 1 ? "1px dotted #eee" : "none",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span style={{ flex: 1, fontSize: "12px", fontWeight: 600, paddingRight: "4px" }}>
                {item.name}
                {item.nameAr && (
                  <span style={{ fontSize: "11px", direction: "rtl", unicodeBidi: "embed", marginLeft: "4px" }}>
                    {item.nameAr}
                  </span>
                )}
              </span>
              <span style={{ width: "45px", textAlign: "center", fontSize: "12px" }}>{item.quantity}</span>
              <span style={{ width: "55px", textAlign: "right", fontSize: "11px" }}>
                {formatCurrency(item.unitPrice, cur)}
              </span>
              <span style={{ width: "60px", textAlign: "right", fontSize: "12px", fontWeight: 600 }}>
                {formatCurrency(item.lineTotal, cur)}
              </span>
            </div>
            {item.discount > 0 && (
              <div style={{ fontSize: "10px", color: "#666", paddingLeft: "4px" }}>
                {bl("Disc", "خصم")}: -{formatCurrency(item.discount, cur)}
              </div>
            )}
            {item.modifiers && item.modifiers.length > 0 && (
              <div style={{ paddingLeft: "8px", marginTop: "1px" }}>
                {item.modifiers.map((mod, j) => (
                  <div key={j} style={{ fontSize: "10px", color: "#555" }}>+ {mod}</div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={accentDivider} />

      {/* Totals */}
      <div style={{ padding: "0 1px" }}>
        <div style={{ ...rowStyle, fontSize: "12px", marginBottom: "2px" }}>
          <span>{bl("Subtotal", "المجموع الفرعي")}</span>
          <span style={{ fontWeight: 600 }}>{formatCurrency(data.subtotal, cur)}</span>
        </div>
        {data.taxAmount !== 0 && (
          <div style={{ ...rowStyle, fontSize: "12px", marginBottom: "2px" }}>
            <span>
              {taxLbl}
              {data.isTaxInclusivePrice && (
                <span style={{ fontSize: "9px", color: "#666" }}> ({bl("Incl.", "شامل")})</span>
              )}
            </span>
            <span style={{ fontWeight: 600 }}>{formatCurrency(data.taxAmount, cur)}</span>
          </div>
        )}
        {data.roundOffAmount != null && data.roundOffAmount !== 0 && (
          <div style={{ ...rowStyle, fontSize: "11px", color: "#666", marginBottom: "2px" }}>
            <span>{bl("Round Off", "التقريب")}</span>
            <span>{data.roundOffAmount > 0 ? "+" : ""}{formatCurrency(data.roundOffAmount, cur)}</span>
          </div>
        )}

        {/* Grand Total */}
        <div style={{
          ...rowStyle,
          fontSize: "16px",
          fontWeight: 800,
          marginTop: "4px",
          padding: "6px 8px",
          background: color,
          color: "#fff",
          borderRadius: "4px",
        }}>
          <span>{bl("TOTAL", "الإجمالي")}</span>
          <span>{formatCurrency(data.total, cur)}</span>
        </div>
      </div>

      <div style={{ height: "1px", background: "#ddd", margin: "10px 0 8px 0", border: "none" }} />

      {/* Footer */}
      <div style={{
        ...centerStyle,
        fontSize: "11px",
        fontWeight: 600,
        padding: "4px 8px",
        border: "1px dashed #999",
        borderRadius: "4px",
      }}>
        {isZatca ? (
          <>
            <div style={{ direction: "rtl", marginBottom: "2px" }}>يرجى تقديم هذه الفاتورة عند الدفع</div>
            <div>Please present this bill at the payment counter</div>
          </>
        ) : (
          <div>Please present this bill at the payment counter</div>
        )}
      </div>

      <div style={{
        ...centerStyle,
        fontSize: "9px",
        color: "#999",
        marginTop: "6px",
      }}>
        {bl("This is not a tax invoice", "هذه ليست فاتورة ضريبية")}
      </div>
    </div>
  );
}
