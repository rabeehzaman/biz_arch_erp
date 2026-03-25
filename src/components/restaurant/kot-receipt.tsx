import React from "react";
import { format } from "date-fns";

export interface KOTReceiptData {
  kotNumber: string;
  kotType: "STANDARD" | "FOLLOWUP" | "VOID";
  orderType: "DINE_IN" | "TAKEAWAY";
  tableName?: string;
  tableNumber?: number;
  section?: string;
  serverName?: string;
  guestCount?: number;
  timestamp: Date;
  items: {
    name: string;
    nameAr?: string;
    quantity: number;
    modifiers?: string[];
    notes?: string;
    isNew?: boolean;
  }[];
  specialInstructions?: string;
  isReprint?: boolean;
}

const KOT_TYPE_LABELS: Record<KOTReceiptData["kotType"], string> = {
  STANDARD: "NEW ORDER",
  FOLLOWUP: "FOLLOW-UP",
  VOID: "VOID / CANCELLED",
};

export function KOTReceipt({ data }: { data: KOTReceiptData }) {
  const containerStyle: React.CSSProperties = {
    width: "100%",
    fontFamily: "'Courier New', 'Courier', monospace",
    fontSize: "14px",
    lineHeight: "1.4",
    color: "#000",
    padding: "0 0 3mm 0",
  };

  const centerStyle: React.CSSProperties = { textAlign: "center" };

  const dashedDivider: React.CSSProperties = {
    borderTop: "2px dashed #000",
    margin: "6px 0",
  };

  const thinDivider: React.CSSProperties = {
    borderTop: "1px dashed #000",
    margin: "4px 0",
  };

  const typeLabel = KOT_TYPE_LABELS[data.kotType];
  const isVoid = data.kotType === "VOID";

  return (
    <div style={containerStyle}>
      {/* Reprint Banner */}
      {data.isReprint && (
        <div style={{
          ...centerStyle,
          fontSize: "16px",
          fontWeight: 900,
          padding: "4px 0",
          marginBottom: "4px",
          border: "2px solid #000",
          letterSpacing: "2px",
        }}>
          ** REPRINT **
        </div>
      )}

      {/* Header */}
      <div style={{
        ...centerStyle,
        fontSize: "18px",
        fontWeight: 900,
        letterSpacing: "1px",
        padding: "4px 0",
      }}>
        KITCHEN ORDER TICKET
      </div>

      {/* KOT Number - Large and Bold */}
      <div style={{
        ...centerStyle,
        fontSize: "28px",
        fontWeight: 900,
        padding: "4px 0",
        letterSpacing: "2px",
      }}>
        #{data.kotNumber}
      </div>

      {/* Type Indicator */}
      <div style={{
        ...centerStyle,
        fontSize: "16px",
        fontWeight: 900,
        padding: "4px 8px",
        margin: "4px 0",
        border: isVoid ? "3px solid #000" : "2px solid #000",
        letterSpacing: "1px",
        ...(isVoid ? { textDecoration: "underline" } : {}),
      }}>
        {typeLabel}
      </div>

      <div style={dashedDivider} />

      {/* Order Info */}
      <div style={{ padding: "2px 0" }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "14px",
          fontWeight: 700,
        }}>
          <span>{data.orderType === "DINE_IN" ? "DINE-IN" : "TAKEAWAY"}</span>
          <span>{format(data.timestamp, "hh:mm a")}</span>
        </div>

        {data.orderType === "DINE_IN" && (data.tableName || data.tableNumber) && (
          <div style={{
            fontSize: "18px",
            fontWeight: 900,
            marginTop: "4px",
          }}>
            Table: {data.tableName || `#${data.tableNumber}`}
            {data.section && (
              <span style={{ fontSize: "13px", fontWeight: 600 }}>
                {" "}({data.section})
              </span>
            )}
          </div>
        )}

        <div style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "12px",
          marginTop: "2px",
        }}>
          {data.guestCount != null && data.guestCount > 0 && (
            <span>Guests: {data.guestCount}</span>
          )}
          {data.serverName && (
            <span>Server: {data.serverName}</span>
          )}
        </div>

        <div style={{ fontSize: "11px", marginTop: "2px" }}>
          {format(data.timestamp, "dd MMM yyyy")}
        </div>
      </div>

      <div style={dashedDivider} />

      {/* Column Headers */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: "12px",
        fontWeight: 700,
        padding: "2px 0",
        borderBottom: "1px solid #000",
        marginBottom: "4px",
      }}>
        <span style={{ width: "40px" }}>QTY</span>
        <span style={{ flex: 1 }}>ITEM</span>
      </div>

      {/* Items */}
      <div>
        {data.items.map((item, i) => (
          <div key={i} style={{
            paddingBottom: "6px",
            marginBottom: "4px",
            borderBottom: i < data.items.length - 1 ? "1px dotted #000" : "none",
          }}>
            <div style={{
              display: "flex",
              alignItems: "flex-start",
            }}>
              {/* Quantity */}
              <span style={{
                width: "40px",
                fontSize: "16px",
                fontWeight: 900,
                flexShrink: 0,
              }}>
                {item.quantity}x
              </span>

              {/* Item Name */}
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: "15px",
                  fontWeight: item.isNew ? 900 : 700,
                  ...(isVoid ? { textDecoration: "line-through" } : {}),
                }}>
                  {item.name}
                  {item.nameAr && (
                    <span style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      marginLeft: "6px",
                      direction: "rtl",
                      unicodeBidi: "embed",
                    }}>
                      {item.nameAr}
                    </span>
                  )}
                  {item.isNew && (
                    <span style={{
                      fontSize: "10px",
                      fontWeight: 900,
                      marginLeft: "4px",
                      border: "1px solid #000",
                      padding: "0 3px",
                    }}>
                      NEW
                    </span>
                  )}
                </div>

                {/* Modifiers */}
                {item.modifiers && item.modifiers.length > 0 && (
                  <div style={{ marginTop: "2px" }}>
                    {item.modifiers.map((mod, j) => (
                      <div key={j} style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        paddingLeft: "8px",
                      }}>
                        &gt;&gt; {mod}
                      </div>
                    ))}
                  </div>
                )}

                {/* Item Notes */}
                {item.notes && (
                  <div style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    fontStyle: "italic",
                    paddingLeft: "8px",
                    marginTop: "2px",
                  }}>
                    * {item.notes}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Special Instructions */}
      {data.specialInstructions && (
        <>
          <div style={thinDivider} />
          <div style={{
            padding: "4px 0",
            border: "1px solid #000",
            marginTop: "2px",
          }}>
            <div style={{
              fontSize: "12px",
              fontWeight: 900,
              textAlign: "center",
              marginBottom: "2px",
              textDecoration: "underline",
            }}>
              SPECIAL INSTRUCTIONS
            </div>
            <div style={{
              fontSize: "13px",
              fontWeight: 700,
              padding: "2px 4px",
            }}>
              {data.specialInstructions}
            </div>
          </div>
        </>
      )}

      <div style={dashedDivider} />

      {/* Footer */}
      <div style={{
        ...centerStyle,
        fontSize: "11px",
        padding: "2px 0",
      }}>
        Items: {data.items.length} | Total Qty: {data.items.reduce((sum, item) => sum + item.quantity, 0)}
      </div>
    </div>
  );
}
