"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, use } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Loader2, ArrowLeft, Pencil, Plus, CreditCard, Trash2, Wallet, UserPlus, Ban } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageAnimation } from "@/components/ui/page-animation";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { useLanguage } from "@/lib/i18n";
import { useCurrency } from "@/hooks/use-currency";
import { toast } from "sonner";

type DetailTab = "overview" | "transactions" | "statement" | "comments";

function TabPanelFallback() {
  return (
    <div className="flex h-80 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

const OverviewTab = dynamic(
  () => import("@/components/customers/detail/customer-overview-tab").then((mod) => mod.CustomerOverviewTab),
  { loading: () => <TabPanelFallback /> }
);
const TransactionsTab = dynamic(
  () => import("@/components/customers/detail/customer-transactions-tab").then((mod) => mod.CustomerTransactionsTab),
  { loading: () => <TabPanelFallback /> }
);
const StatementTab = dynamic(
  () => import("@/components/customers/detail/customer-statement-tab").then((mod) => mod.CustomerStatementTab),
  { loading: () => <TabPanelFallback /> }
);
const CommentsTab = dynamic(
  () => import("@/components/customers/detail/customer-comments-tab").then((mod) => mod.CustomerCommentsTab),
  { loading: () => <TabPanelFallback /> }
);

interface CustomerBasic {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  balance: number;
  isActive: boolean;
  arabicName: string | null;
}

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useLanguage();
  const { fmt } = useCurrency();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "admin" || (session?.user as { role?: string })?.role === "superadmin";

  const defaultTab = (searchParams.get("tab") as DetailTab) || "overview";
  const [activeTab, setActiveTab] = useState<DetailTab>(defaultTab);
  const [loadedTabs, setLoadedTabs] = useState<DetailTab[]>([defaultTab]);

  const [customer, setCustomer] = useState<CustomerBasic | null>(null);
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Opening balance dialog state
  const [showOBDialog, setShowOBDialog] = useState(false);
  const [obAmount, setObAmount] = useState("");
  const [obDate, setObDate] = useState(new Date().toISOString().slice(0, 10));
  const [isSettingOB, setIsSettingOB] = useState(false);

  useEffect(() => {
    const fetchCustomer = async () => {
      try {
        const res = await fetch(`/api/customers/${id}`);
        if (!res.ok) throw new Error("Not found");
        const data = await res.json();
        setCustomer(data);
      } catch {
        router.push("/customers");
      } finally {
        setIsLoadingCustomer(false);
      }
    };
    fetchCustomer();
  }, [id, router]);

  const getForceMountProps = (tab: DetailTab) =>
    loadedTabs.includes(tab) ? { forceMount: true as const } : {};

  const handleTabChange = (value: string) => {
    const nextTab = value as DetailTab;
    setActiveTab(nextTab);
    setLoadedTabs((current) => (current.includes(nextTab) ? current : [...current, nextTab]));
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success(t("customers.deleted"));
      router.push("/customers");
    } catch {
      toast.error(t("common.error"));
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleSetOpeningBalance = async () => {
    if (!obAmount) return;
    setIsSettingOB(true);
    try {
      const res = await fetch(`/api/customers/${id}/opening-balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseFloat(obAmount), transactionDate: obDate }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("customers.openingBalanceSet"));
      setShowOBDialog(false);
      // Refresh customer data
      const updated = await fetch(`/api/customers/${id}`);
      if (updated.ok) setCustomer(await updated.json());
    } catch {
      toast.error(t("common.error"));
    } finally {
      setIsSettingOB(false);
    }
  };

  if (isLoadingCustomer) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  if (!customer) return null;

  return (
    <PageAnimation>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Link href="/customers">
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-xl font-bold text-slate-900 sm:text-2xl">
                  {customer.name}
                </h2>
                <Badge variant={customer.isActive ? "success" : "secondary"} className="shrink-0">
                  {customer.isActive ? t("common.active") : t("common.inactive")}
                </Badge>
              </div>
              {customer.email && (
                <p className="truncate text-sm text-slate-500">{customer.email}</p>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:gap-2">
            <Link href={`/invoices/create?customerId=${id}`}>
              <Button variant="outline" size="sm" className="w-full">
                <Plus className="mr-1 h-4 w-4" />
                {t("customerDetail.newInvoice")}
              </Button>
            </Link>
            <Link href={`/payments/create?customerId=${id}`}>
              <Button variant="outline" size="sm" className="w-full">
                <CreditCard className="mr-1 h-4 w-4" />
                {t("customerDetail.newPayment")}
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
              <Pencil className="mr-1 h-4 w-4" />
              {t("common.edit")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {t("common.more")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  setShowOBDialog(true);
                  // Fetch existing OB
                  fetch(`/api/customers/${id}/opening-balance`).then(r => r.ok ? r.json() : null).then(data => {
                    if (data) { setObAmount(String(Number(data.amount))); setObDate(data.transactionDate?.slice(0,10) || new Date().toISOString().slice(0,10)); }
                  });
                }}>
                  <Wallet className="mr-2 h-4 w-4" />
                  {t("customers.setOpeningBalance")}
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onClick={() => router.push(`/customers?assign=${id}`)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    {t("customers.assignToUsers")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={async () => {
                  try {
                    await fetch(`/api/customers/${id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ isActive: !customer.isActive }),
                    });
                    setCustomer({ ...customer, isActive: !customer.isActive });
                    toast.success(customer.isActive ? t("customers.markedInactive") : t("customers.markedActive"));
                  } catch { toast.error(t("common.error")); }
                }}>
                  <Ban className="mr-2 h-4 w-4" />
                  {customer.isActive ? t("customers.markInactive") : t("customers.markActive")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600" onClick={() => setShowDeleteDialog(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("common.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList variant="line">
            <TabsTrigger value="overview">{t("customerDetail.overview")}</TabsTrigger>
            <TabsTrigger value="transactions">{t("customerDetail.transactions")}</TabsTrigger>
            <TabsTrigger value="statement">{t("customerDetail.statement")}</TabsTrigger>
            <TabsTrigger value="comments">{t("customerDetail.comments")}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" {...getForceMountProps("overview")} className="mt-6 data-[state=inactive]:hidden">
            <OverviewTab customerId={id} />
          </TabsContent>
          <TabsContent value="transactions" {...getForceMountProps("transactions")} className="mt-6 data-[state=inactive]:hidden">
            <TransactionsTab customerId={id} />
          </TabsContent>
          <TabsContent value="statement" {...getForceMountProps("statement")} className="mt-6 data-[state=inactive]:hidden">
            <StatementTab customerId={id} />
          </TabsContent>
          <TabsContent value="comments" {...getForceMountProps("comments")} className="mt-6 data-[state=inactive]:hidden">
            <CommentsTab customerId={id} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Dialog */}
      <CustomerFormDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        customerToEdit={customer as never}
        onSuccess={(updated) => {
          setCustomer({ ...customer, ...updated });
        }}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={t("customers.deleteTitle")}
        description={t("customers.deleteDescription")}
        onConfirm={handleDelete}
        variant="destructive"
      />

      {/* Opening Balance Dialog */}
      {showOBDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowOBDialog(false)}>
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">{t("customers.setOpeningBalance")}</h3>
            <div className="mt-4 space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">{t("common.amount")}</label>
                <input type="number" step="0.001" className="rounded-lg border px-3 py-2 text-sm" value={obAmount} onChange={(e) => setObAmount(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">{t("common.date")}</label>
                <input type="date" className="rounded-lg border px-3 py-2 text-sm" value={obDate} onChange={(e) => setObDate(e.target.value)} />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowOBDialog(false)}>{t("common.cancel")}</Button>
              <Button size="sm" onClick={handleSetOpeningBalance} disabled={isSettingOB || !obAmount}>
                {isSettingOB && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                {t("common.save")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageAnimation>
  );
}
