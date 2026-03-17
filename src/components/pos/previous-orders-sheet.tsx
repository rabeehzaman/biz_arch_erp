"use client";

import { useState } from "react";
import useSWR from "swr";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Printer, ShoppingBag } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { smartPrintReceipt } from "@/lib/electron-print";
import type { ReceiptData } from "@/components/pos/receipt";
import { useLanguage } from "@/lib/i18n";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface OrderItem {
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  gstRate: number | null;
  vatRate: number | null;
}

interface OrderPayment {
  paymentMethod: string;
  amount: number;
}

interface Order {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  subtotal: number;
  total: number;
  roundOffAmount: number | null;
  amountPaid: number | null;
  totalCgst: number | null;
  totalSgst: number | null;
  totalIgst: number | null;
  totalVat: number | null;
  qrCodeData: string | null;
  qrCodeDataURL: string | null;
  customer: { name: string } | null;
  items: OrderItem[];
  payments: OrderPayment[];
}

interface ReceiptMeta {
  logoUrl: string | null;
  logoHeight: number;
  brandColor: string | null;
  vatNumber: string | null;
  arabicName: string | null;
  taxLabel: string;
  currency: string;
  isTaxInclusivePrice: boolean;
}

interface PreviousOrdersSheetProps {
  open: boolean;
  onClose: () => void;
  sessionId: string | null;
  companySettings: {
    companyName?: string;
    companyAddress?: string;
    companyCity?: string;
    companyState?: string;
    companyPhone?: string;
    companyGstNumber?: string;
  } | undefined;
}

export function PreviousOrdersSheet({
  open,
  onClose,
  sessionId,
  companySettings,
}: PreviousOrdersSheetProps) {
  const { t } = useLanguage();
  const { data, isLoading } = useSWR<{ orders: Order[]; receiptMeta: ReceiptMeta }>(
    open && sessionId ? `/api/pos/sessions/${sessionId}/orders` : null,
    fetcher
  );

  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);

  const orders = data?.orders ?? [];
  const receiptMeta = data?.receiptMeta;

  async function handlePrint(order: Order) {
    if (!receiptMeta) return;
    setPrintingOrderId(order.id);
    try {
      const isVat = receiptMeta.taxLabel === "VAT";
      const taxAmount = isVat
        ? Number(order.totalVat ?? 0)
        : Number(order.totalCgst ?? 0) + Number(order.totalSgst ?? 0) + Number(order.totalIgst ?? 0);
      const totalPaid = order.payments.reduce((sum, p) => sum + Number(p.amount), 0);

      const receiptData: ReceiptData = {
        storeName: companySettings?.companyName || "Store",
        storeAddress: companySettings?.companyAddress,
        storeCity: companySettings?.companyCity,
        storeState: companySettings?.companyState,
        storePhone: companySettings?.companyPhone,
        storeGstin: companySettings?.companyGstNumber,
        invoiceNumber: order.invoiceNumber,
        date: new Date(order.issueDate),
        customerName: order.customer?.name,
        items: order.items.map((item) => ({
          name: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          lineTotal: item.total,
        })),
        subtotal: Number(order.subtotal),
        taxRate: isVat ? 15 : 0,
        taxAmount,
        roundOffAmount: order.roundOffAmount ? Number(order.roundOffAmount) : undefined,
        total: Number(order.total),
        payments: order.payments.map((p) => ({
          method: p.paymentMethod,
          amount: Number(p.amount),
        })),
        change: Math.max(0, totalPaid - Number(order.total)),
        logoUrl: receiptMeta.logoUrl || undefined,
        logoHeight: receiptMeta.logoHeight || undefined,
        qrCodeDataURL: order.qrCodeDataURL || undefined,
        vatNumber: receiptMeta.vatNumber || companySettings?.companyGstNumber || undefined,
        arabicName: receiptMeta.arabicName || undefined,
        taxLabel: receiptMeta.taxLabel,
        brandColor: receiptMeta.brandColor || undefined,
        currency: receiptMeta.currency,
        isTaxInclusivePrice: receiptMeta.isTaxInclusivePrice,
      };

      await smartPrintReceipt(receiptData);
    } finally {
      setPrintingOrderId(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:w-[420px] sm:max-w-[480px] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b shrink-0">
          <SheetTitle>{t("pos.previousOrders")}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
              <ShoppingBag className="h-8 w-8" />
              <span className="text-sm">{t("pos.noOrdersYet")}</span>
            </div>
          ) : (
            <ul className="divide-y">
              {orders.map((order) => (
                <li key={order.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{order.invoiceNumber}</span>
                      {order.customer?.name && (
                        <span className="text-xs text-muted-foreground truncate">
                          · {order.customer.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span>{formatDistanceToNow(new Date(order.issueDate), { addSuffix: true })}</span>
                      <span>· {order.items.length} {order.items.length !== 1 ? t("common.items") : t("common.item")}</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold shrink-0">
                    {Number(order.total).toFixed(2)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => handlePrint(order)}
                    disabled={printingOrderId === order.id}
                    title={t("pos.printReceipt")}
                  >
                    {printingOrderId === order.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Printer className="h-4 w-4" />
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
