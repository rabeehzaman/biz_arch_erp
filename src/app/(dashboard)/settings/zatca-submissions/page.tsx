"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageAnimation } from "@/components/ui/page-animation";
import { useLanguage } from "@/lib/i18n";
import { getZatcaStatusBadgeProps, isRetryableStatus } from "@/lib/zatca-helpers";
import {
  ArrowLeft, FileText, Loader2, RefreshCw, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface Submission {
  id: string;
  documentType: string;
  documentId: string;
  documentNumber: string;
  submissionMode: string;
  status: string;
  warnings: string[];
  errors: string[];
  attemptCount: number;
  lastAttemptAt: string | null;
  createdAt: string;
}

export default function ZatcaSubmissionsPage() {
  const { t } = useLanguage();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("documentType", typeFilter);
      params.set("limit", "50");
      const res = await fetch(`/api/zatca/submissions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.data || []);
        setTotal(data.total || 0);
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const handleRetry = async (sub: Submission) => {
    if (!sub.documentId) { toast.error("No document ID"); return; }
    setRetryingId(sub.id);
    try {
      const type = sub.documentType === "CREDIT_NOTE" ? "credit_note" : sub.documentType === "DEBIT_NOTE" ? "debit_note" : "invoice";
      const res = await fetch(`/api/zatca/submit/${sub.documentId}?type=${type}`, { method: "POST" });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      toast.success(t("zatca.retrySuccess"));
      fetchSubmissions();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("zatca.retryFailed"));
    } finally {
      setRetryingId(null);
    }
  };

  const docTypeLabel = (dt: string) => {
    switch (dt) {
      case "INVOICE": return t("zatca.invoice");
      case "CREDIT_NOTE": return t("zatca.creditNote");
      case "DEBIT_NOTE": return t("zatca.debitNote");
      default: return dt;
    }
  };

  const modeLabel = (m: string) => m === "CLEARANCE" ? t("zatca.clearance") : t("zatca.reporting");

  const relativeTime = (iso: string | null) => {
    if (!iso) return "-";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(iso).toLocaleDateString();
  };

  return (
    <PageAnimation>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/settings">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("zatca.submissionsTitle")}</h2>
            <p className="text-sm text-slate-500">{t("zatca.submissionsDesc")}</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm">
                <option value="">{t("zatca.allStatuses")}</option>
                <option value="CLEARED">{t("zatca.cleared")}</option>
                <option value="REPORTED">{t("zatca.reported")}</option>
                <option value="PENDING">{t("zatca.pending")}</option>
                <option value="WARNING">{t("zatca.warning")}</option>
                <option value="REJECTED">{t("zatca.rejected")}</option>
                <option value="FAILED">{t("zatca.failed")}</option>
              </select>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm">
                <option value="">{t("zatca.allTypes")}</option>
                <option value="INVOICE">{t("zatca.invoice")}</option>
                <option value="CREDIT_NOTE">{t("zatca.creditNote")}</option>
                <option value="DEBIT_NOTE">{t("zatca.debitNote")}</option>
              </select>
              <span className="text-xs text-slate-500 ml-auto">{total} total</span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : submissions.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-500">{t("zatca.noSubmissions")}</p>
                <p className="text-xs text-slate-400 mt-1">{t("zatca.noSubmissionsDesc")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {submissions.map((sub) => {
                  const badge = getZatcaStatusBadgeProps(sub.status);
                  const canRetry = isRetryableStatus(sub.status);
                  return (
                    <div key={sub.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-slate-900">{sub.documentNumber || "-"}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{docTypeLabel(sub.documentType)}</Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{modeLabel(sub.submissionMode)}</Badge>
                          <Badge variant="outline" className={`${badge.className} text-[10px] px-1.5 py-0`}>{badge.label}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                          <span>{t("zatca.attemptCount")}: {sub.attemptCount}</span>
                          <span>{t("zatca.lastAttempt")}: {relativeTime(sub.lastAttemptAt)}</span>
                          <span>{relativeTime(sub.createdAt)}</span>
                        </div>
                        {sub.errors.length > 0 && (
                          <div className="mt-1.5 flex items-start gap-1">
                            <AlertCircle className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
                            <span className="text-xs text-red-600 line-clamp-1">{sub.errors[0]}</span>
                          </div>
                        )}
                      </div>
                      {canRetry && (
                        <Button variant="ghost" size="sm" onClick={() => handleRetry(sub)}
                          disabled={retryingId === sub.id}>
                          {retryingId === sub.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <RefreshCw className="h-3 w-3" />}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageAnimation>
  );
}
