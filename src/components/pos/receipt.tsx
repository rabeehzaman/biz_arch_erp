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
}

const dividerStyle: React.CSSProperties = {
  borderTop: "1px dashed #000",
  margin: "6px 0",
};

const formatCurrency = (amount: number) =>
  amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PosReceipt({ data }: { data: ReceiptData }) {
  const containerStyle: React.CSSProperties = {
    width: "72mm",
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: "11px",
    lineHeight: "1.4",
    color: "#000",
    padding: "4mm 0",
  };

  const centerStyle: React.CSSProperties = { textAlign: "center" };
  const rowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between" };
  const boldStyle: React.CSSProperties = { fontWeight: "bold" };

  return (
    <div style={containerStyle}>
      {/* Store Header */}
      <div style={centerStyle}>
        <div style={{ ...boldStyle, fontSize: "14px" }}>{data.storeName || "Store"}</div>
        {data.storeAddress && <div>{data.storeAddress}</div>}
        {(data.storeCity || data.storeState) && (
          <div>{[data.storeCity, data.storeState].filter(Boolean).join(", ")}</div>
        )}
        {data.storePhone && <div>Ph: {data.storePhone}</div>}
        {data.storeGstin && <div>GSTIN: {data.storeGstin}</div>}
      </div>

      <div style={dividerStyle} />

      {/* Invoice Info */}
      <div>
        <div style={rowStyle}>
          <span>Inv#: {data.invoiceNumber}</span>
        </div>
        <div style={rowStyle}>
          <span>{format(data.date, "dd/MM/yyyy")}</span>
          <span>{format(data.date, "hh:mm a")}</span>
        </div>
        {data.customerName && (
          <div>Customer: {data.customerName}</div>
        )}
      </div>

      <div style={dividerStyle} />

      {/* Items */}
      <div>
        {data.items.map((item, i) => (
          <div key={i} style={{ marginBottom: "4px" }}>
            <div>{item.name}</div>
            <div style={rowStyle}>
              <span>
                {item.quantity} x {formatCurrency(item.unitPrice)}
                {item.discount > 0 ? ` (-${item.discount}%)` : ""}
              </span>
              <span>{formatCurrency(item.lineTotal)}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={dividerStyle} />

      {/* Totals */}
      <div>
        <div style={rowStyle}>
          <span>Subtotal</span>
          <span>{formatCurrency(data.subtotal)}</span>
        </div>
        {data.taxAmount > 0 && (
          <div style={rowStyle}>
            <span>GST</span>
            <span>{formatCurrency(data.taxAmount)}</span>
          </div>
        )}
        <div style={{ ...rowStyle, ...boldStyle, fontSize: "13px", marginTop: "4px" }}>
          <span>TOTAL</span>
          <span>{formatCurrency(data.total)}</span>
        </div>
      </div>

      <div style={dividerStyle} />

      {/* Payments */}
      <div>
        {data.payments.map((p, i) => (
          <div key={i} style={rowStyle}>
            <span>{p.method}</span>
            <span>{formatCurrency(p.amount)}</span>
          </div>
        ))}
        {data.change > 0 && (
          <div style={{ ...rowStyle, ...boldStyle }}>
            <span>Change</span>
            <span>{formatCurrency(data.change)}</span>
          </div>
        )}
      </div>

      <div style={dividerStyle} />

      {/* Footer */}
      <div style={{ ...centerStyle, marginTop: "6px" }}>
        <div>Thank you for your purchase!</div>
      </div>
    </div>
  );
}
