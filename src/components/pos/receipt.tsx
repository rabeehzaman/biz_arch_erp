import React from "react";
import { format } from "date-fns";

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

export interface ReceiptPayment {
  method: string;
  amount: number;
}

export interface ReceiptData {
  storeName: string;
  storeAddress?: string;
  storeCity?: string;
  storeState?: string;
  storePhone?: string;
  storeGstin?: string;
  invoiceNumber: string;
  date: Date;
  customerName?: string;
  items: ReceiptItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  payments: ReceiptPayment[];
  change: number;
  // Enhanced fields
  logoUrl?: string;
  qrCodeDataURL?: string;
  vatNumber?: string;
  arabicName?: string;
  taxLabel?: string;
  brandColor?: string;
  currency?: string;
}

const formatCurrency = (amount: number, currency?: string) => {
  if (currency === "SAR") {
    return amount.toLocaleString("en-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export function PosReceipt({ data }: { data: ReceiptData }) {
  const color = data.brandColor || "#1a1a2e";
  const cur = data.currency;
  const taxLbl = data.taxLabel || (data.storeGstin ? "GST" : "Tax");
  const displayVat = data.vatNumber || data.storeGstin;

  const containerStyle: React.CSSProperties = {
    width: "72mm",
    fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Noto Sans Arabic', sans-serif",
    fontSize: "11px",
    lineHeight: "1.5",
    color: "#222",
    padding: "3mm 0",
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

  const dottedDivider: React.CSSProperties = {
    borderTop: "1px dashed #ccc",
    margin: "6px 0",
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
              maxHeight: "48px",
              maxWidth: "55mm",
              objectFit: "contain",
              display: "inline-block",
            }}
          />
        </div>
      )}

      {/* Store Header */}
      <div style={centerStyle}>
        {data.arabicName && (
          <div style={{
            fontSize: "14px",
            fontWeight: 700,
            direction: "rtl",
            marginBottom: "2px",
            color: color,
          }}>
            {data.arabicName}
          </div>
        )}
        <div style={{
          fontWeight: 700,
          fontSize: "15px",
          letterSpacing: "0.5px",
          color: color,
        }}>
          {data.storeName || "Store"}
        </div>
        {data.storeAddress && (
          <div style={{ fontSize: "10px", color: "#555", marginTop: "2px" }}>{data.storeAddress}</div>
        )}
        {(data.storeCity || data.storeState) && (
          <div style={{ fontSize: "10px", color: "#555" }}>
            {[data.storeCity, data.storeState].filter(Boolean).join(", ")}
          </div>
        )}
        {data.storePhone && (
          <div style={{ fontSize: "10px", color: "#555" }}>Tel: {data.storePhone}</div>
        )}
        {displayVat && (
          <div style={{
            fontSize: "10px",
            fontWeight: 600,
            color: "#333",
            marginTop: "3px",
            padding: "2px 8px",
            background: "#f5f5f5",
            borderRadius: "3px",
            display: "inline-block",
          }}>
            {taxLbl === "VAT" ? "VAT No" : "GSTIN"}: {displayVat}
          </div>
        )}
      </div>

      {/* Accent Divider */}
      <div style={accentDivider} />

      {/* Invoice Info */}
      <div style={{ padding: "0 1px" }}>
        <div style={{ ...rowStyle, fontWeight: 600, fontSize: "11px" }}>
          <span>#{data.invoiceNumber}</span>
          <span>{format(data.date, "dd MMM yyyy")}</span>
        </div>
        <div style={{ ...rowStyle, fontSize: "10px", color: "#666" }}>
          {data.customerName ? (
            <span>Customer: {data.customerName}</span>
          ) : (
            <span>&nbsp;</span>
          )}
          <span>{format(data.date, "hh:mm a")}</span>
        </div>
      </div>

      {/* Thin Divider */}
      <div style={thinDivider} />

      {/* Column Headers */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: "9px",
        fontWeight: 700,
        textTransform: "uppercase",
        color: "#888",
        letterSpacing: "0.5px",
        padding: "0 1px",
        marginBottom: "4px",
      }}>
        <span style={{ flex: 1 }}>Item</span>
        <span style={{ width: "50px", textAlign: "center" }}>Qty</span>
        <span style={{ width: "55px", textAlign: "right" }}>Price</span>
        <span style={{ width: "60px", textAlign: "right" }}>Total</span>
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
              <span style={{ flex: 1, fontSize: "11px", fontWeight: 500, paddingRight: "4px" }}>
                {item.name}
              </span>
              <span style={{ width: "50px", textAlign: "center", fontSize: "10px", color: "#555" }}>
                {item.quantity}
              </span>
              <span style={{ width: "55px", textAlign: "right", fontSize: "10px", color: "#555" }}>
                {formatCurrency(item.unitPrice, cur)}
              </span>
              <span style={{ width: "60px", textAlign: "right", fontSize: "11px", fontWeight: 600 }}>
                {formatCurrency(item.lineTotal, cur)}
              </span>
            </div>
            {item.discount > 0 && (
              <div style={{ fontSize: "9px", color: "#e74c3c", marginTop: "1px" }}>
                Disc: {item.discount}%
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Dotted Divider */}
      <div style={dottedDivider} />

      {/* Totals */}
      <div style={{ padding: "0 1px" }}>
        <div style={{ ...rowStyle, fontSize: "11px", color: "#555" }}>
          <span>Subtotal</span>
          <span>{formatCurrency(data.subtotal, cur)}</span>
        </div>
        {data.taxAmount > 0 && (
          <div style={{ ...rowStyle, fontSize: "11px", color: "#555", marginTop: "2px" }}>
            <span>{taxLbl} {data.taxRate > 0 ? `(${data.taxRate}%)` : ""}</span>
            <span>{formatCurrency(data.taxAmount, cur)}</span>
          </div>
        )}
        <div style={{
          ...rowStyle,
          fontWeight: 700,
          fontSize: "14px",
          marginTop: "6px",
          padding: "6px 8px",
          background: color,
          color: "#fff",
          borderRadius: "4px",
        }}>
          <span>TOTAL</span>
          <span>{cur === "SAR" ? "SAR " : cur === "INR" ? "\u20B9" : ""}{formatCurrency(data.total, cur)}</span>
        </div>
      </div>

      {/* Thin Divider */}
      <div style={thinDivider} />

      {/* Payments */}
      <div style={{ padding: "0 1px" }}>
        <div style={{
          fontSize: "9px",
          fontWeight: 700,
          textTransform: "uppercase",
          color: "#888",
          letterSpacing: "0.5px",
          marginBottom: "3px",
        }}>
          Payment
        </div>
        {data.payments.map((p, i) => (
          <div key={i} style={{ ...rowStyle, fontSize: "11px" }}>
            <span style={{ color: "#555" }}>{p.method}</span>
            <span style={{ fontWeight: 500 }}>{formatCurrency(p.amount, cur)}</span>
          </div>
        ))}
        {data.change > 0 && (
          <div style={{
            ...rowStyle,
            fontSize: "11px",
            fontWeight: 600,
            marginTop: "3px",
            padding: "3px 6px",
            background: "#f0fdf4",
            borderRadius: "3px",
            border: "1px solid #bbf7d0",
          }}>
            <span>Change</span>
            <span>{formatCurrency(data.change, cur)}</span>
          </div>
        )}
      </div>

      {/* Accent Divider */}
      <div style={accentDivider} />

      {/* QR Code */}
      {data.qrCodeDataURL && (
        <div style={{
          ...centerStyle,
          margin: "4px 0",
          padding: "8px",
          border: "1px solid #e5e7eb",
          borderRadius: "6px",
          background: "#fafafa",
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
            fontSize: "8px",
            color: "#999",
            marginTop: "4px",
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}>
            ZATCA Compliant - Scan to Verify
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        ...centerStyle,
        marginTop: "8px",
        fontSize: "10px",
        color: "#888",
      }}>
        <div style={{ fontWeight: 500 }}>Thank you for your purchase!</div>
      </div>
    </div>
  );
}
