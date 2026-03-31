"use client";

import { useState, useEffect } from "react";
import { useCurrency } from "@/hooks/use-currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/lib/i18n";
import { format } from "date-fns";
import {
  Mail,
  Phone,
  MapPin,
  Calendar,
  FileText,
  CreditCard,
  Receipt,
  ClipboardList,
  Clock,
  AlertTriangle,
} from "lucide-react";

interface CustomerOverview {
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    country: string | null;
    gstin: string | null;
    vatNumber: string | null;
    arabicName: string | null;
    ccNo: string | null;
    buildingNo: string | null;
    addNo: string | null;
    district: string | null;
    balance: number;
    notes: string | null;
    isActive: boolean;
    createdAt: string;
    assignments: Array<{ id: string; user: { id: string; name: string } }>;
  };
  totalOutstanding: number;
  totalUnusedCredits: number;
  aging: {
    current: number;
    days31_60: number;
    days61_90: number;
    days90Plus: number;
  };
  lastInvoiceDate: string | null;
  lastPaymentDate: string | null;
  counts: {
    invoices: number;
    payments: number;
    creditNotes: number;
    quotations: number;
  };
}

export function CustomerOverviewTab({ customerId }: { customerId: string }) {
  const { t } = useLanguage();
  const { fmt } = useCurrency();
  const [data, setData] = useState<CustomerOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const res = await fetch(`/api/customers/${customerId}/overview`);
        if (!res.ok) throw new Error("Failed to fetch");
        setData(await res.json());
      } catch (error) {
        console.error("Failed to fetch overview:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOverview();
  }, [customerId]);

  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { customer } = data;
  const formatCurrency = (v: number) => fmt(Math.abs(v));
  const totalAging = data.aging.current + data.aging.days31_60 + data.aging.days61_90 + data.aging.days90Plus;

  const addressParts = [customer.address, customer.city, customer.state, customer.zipCode, customer.country].filter(Boolean);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Left Column */}
      <div className="space-y-6 lg:col-span-3">
        {/* Contact Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("customerDetail.contactInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {customer.email && (
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-slate-400" />
                <span>{customer.email}</span>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-slate-400" />
                <span>{customer.phone}</span>
              </div>
            )}
            {addressParts.length > 0 && (
              <div className="flex items-start gap-3 text-sm">
                <MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
                <span>{addressParts.join(", ")}</span>
              </div>
            )}
            {!customer.email && !customer.phone && addressParts.length === 0 && (
              <p className="text-sm text-slate-400">{t("customerDetail.noContactInfo")}</p>
            )}
          </CardContent>
        </Card>

        {/* Other Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("customerDetail.otherDetails")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {customer.gstin && (
                <DetailRow label="GSTIN" value={customer.gstin} />
              )}
              {customer.vatNumber && (
                <DetailRow label={t("customerDetail.vatNumber")} value={customer.vatNumber} />
              )}
              {customer.arabicName && (
                <DetailRow label={t("customerDetail.arabicName")} value={customer.arabicName} dir="rtl" />
              )}
              {customer.ccNo && (
                <DetailRow label={t("customerDetail.crNo")} value={customer.ccNo} />
              )}
              {customer.district && (
                <DetailRow label={t("customerDetail.district")} value={customer.district} />
              )}
              {customer.buildingNo && (
                <DetailRow label={t("customerDetail.buildingNo")} value={customer.buildingNo} />
              )}
              {customer.addNo && (
                <DetailRow label={t("customerDetail.addNo")} value={customer.addNo} />
              )}
              <DetailRow
                label={t("customerDetail.createdOn")}
                value={format(new Date(customer.createdAt), "dd MMM yyyy")}
              />
              {customer.assignments && customer.assignments.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500">{t("customerDetail.assignedTo")}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {customer.assignments.map((a) => (
                      <Badge key={a.id} variant="secondary" className="text-xs">
                        {a.user.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {customer.notes && (
              <div className="mt-4 rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-500">{t("common.notes")}</p>
                <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{customer.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Column */}
      <div className="space-y-6 lg:col-span-2">
        {/* Receivables Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("customerDetail.receivables")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">{t("customerDetail.outstanding")}</span>
              <span className="text-lg font-bold text-red-600">{formatCurrency(data.totalOutstanding)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">{t("customerDetail.unusedCredits")}</span>
              <span className="text-lg font-bold text-blue-600">{formatCurrency(data.totalUnusedCredits)}</span>
            </div>
            <div className="border-t pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">{t("common.balance")}</span>
                <span className={`text-lg font-bold ${customer.balance >= 0 ? "text-red-600" : "text-green-600"}`}>
                  {formatCurrency(customer.balance)}
                  <span className="ml-1 text-xs">{customer.balance >= 0 ? "Dr" : "Cr"}</span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Aging Summary */}
        {totalAging > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-base">{t("customerDetail.agingSummary")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <AgingRow label={t("customerDetail.agingCurrent")} amount={formatCurrency(data.aging.current)} percent={totalAging > 0 ? (data.aging.current / totalAging) * 100 : 0} color="bg-green-500" />
              <AgingRow label={t("customerDetail.aging31_60")} amount={formatCurrency(data.aging.days31_60)} percent={totalAging > 0 ? (data.aging.days31_60 / totalAging) * 100 : 0} color="bg-amber-500" />
              <AgingRow label={t("customerDetail.aging61_90")} amount={formatCurrency(data.aging.days61_90)} percent={totalAging > 0 ? (data.aging.days61_90 / totalAging) * 100 : 0} color="bg-orange-500" />
              <AgingRow label={t("customerDetail.aging90Plus")} amount={formatCurrency(data.aging.days90Plus)} percent={totalAging > 0 ? (data.aging.days90Plus / totalAging) * 100 : 0} color="bg-red-500" />
            </CardContent>
          </Card>
        )}

        {/* Quick Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("customerDetail.quickStats")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <StatItem icon={FileText} label={t("customerDetail.invoices")} value={data.counts.invoices} />
              <StatItem icon={CreditCard} label={t("customerDetail.payments")} value={data.counts.payments} />
              <StatItem icon={Receipt} label={t("customerDetail.creditNotes")} value={data.counts.creditNotes} />
              <StatItem icon={ClipboardList} label={t("customerDetail.quotations")} value={data.counts.quotations} />
            </div>
            <div className="mt-4 space-y-2 border-t pt-3">
              {data.lastInvoiceDate && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="h-3 w-3" />
                  <span>{t("customerDetail.lastInvoice")}: {format(new Date(data.lastInvoiceDate), "dd MMM yyyy")}</span>
                </div>
              )}
              {data.lastPaymentDate && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="h-3 w-3" />
                  <span>{t("customerDetail.lastPayment")}: {format(new Date(data.lastPaymentDate), "dd MMM yyyy")}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DetailRow({ label, value, dir }: { label: string; value: string; dir?: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-900" dir={dir}>{value}</p>
    </div>
  );
}

function AgingRow({ label, amount, percent, color }: { label: string; amount: string; percent: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium">{amount}</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  );
}

function StatItem({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <div>
        <p className="text-lg font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}
