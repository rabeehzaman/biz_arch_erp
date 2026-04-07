"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/lib/i18n";
import { getZatcaStatusBadgeProps, getZatcaEnvironmentBadgeProps } from "@/lib/zatca-helpers";
import {
  Shield, CheckCircle, AlertTriangle, Clock, XCircle, ArrowRight,
  RefreshCw, FileText, Loader2, Settings2,
} from "lucide-react";
import { toast } from "sonner";

interface ZatcaStatus {
  phase2Allowed: boolean;
  phase2Active: boolean;
  environment: string;
  clearanceAsync: boolean;
  saudiEInvoiceEnabled: boolean;
  vatNumber: string | null;
  certificate: {
    id: string;
    status: string;
    expiresAt: string | null;
    createdAt: string;
  } | null;
  submissions: {
    pending: number;
    cleared: number;
    reported: number;
    rejected: number;
    warning: number;
    failed: number;
  };
}

export function ZatcaSettings() {
  const { t } = useLanguage();
  const [status, setStatus] = useState<ZatcaStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);
  const [renewOtp, setRenewOtp] = useState("");
  const [showRenewDialog, setShowRenewDialog] = useState(false);
  const [chainLocked, setChainLocked] = useState(false);
  const [isResolvingLock, setIsResolvingLock] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/zatca/status");
      if (res.ok) setStatus(await res.json());
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleRenew = async () => {
    if (!renewOtp) return;
    setIsRenewing(true);
    try {
      const res = await fetch("/api/zatca/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: renewOtp }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Certificate renewed");
        setShowRenewDialog(false);
        setRenewOtp("");
        fetchStatus();
      } else {
        toast.error(data.error || "Renewal failed");
      }
    } catch {
      toast.error("Renewal failed");
    } finally {
      setIsRenewing(false);
    }
  };

  const handleResolveLock = async () => {
    setIsResolvingLock(true);
    try {
      const res = await fetch("/api/zatca/resolve-lock", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Chain lock resolved");
        setChainLocked(false);
      } else {
        toast.error(data.error || "Failed to resolve lock");
      }
    } catch {
      toast.error("Failed to resolve lock");
    } finally {
      setIsResolvingLock(false);
    }
  };

  const toggleAsync = async (value: boolean) => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/zatca/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearanceAsync: value }),
      });
      if (res.ok) {
        setStatus((s) => s ? { ...s, clearanceAsync: value } : s);
        toast.success("Setting updated");
      }
    } catch {
      toast.error("Failed to update setting");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!status?.phase2Allowed) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Shield className="mx-auto h-12 w-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">{t("zatca.title")}</h3>
          <p className="text-sm text-slate-500 mb-4">ZATCA Phase 2 is not enabled for this organization. Contact super admin.</p>
        </CardContent>
      </Card>
    );
  }

  // Not yet active — show setup prompt
  if (!status.phase2Active) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="rounded-full bg-blue-50 p-4">
              <Shield className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{t("zatca.setupTitle")}</h3>
              <p className="text-sm text-slate-500 mt-1">{t("zatca.setupDesc")}</p>
            </div>
            <Link href="/settings/zatca-onboarding">
              <Button>
                {t("zatca.setupButton")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Active — show dashboard
  const cert = status.certificate;
  const subs = status.submissions;
  const totalSubmissions = subs.cleared + subs.reported + subs.pending + subs.rejected + subs.warning + subs.failed;

  const isExpiringSoon = cert?.expiresAt
    ? new Date(cert.expiresAt).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000
    : false;

  const envBadge = getZatcaEnvironmentBadgeProps(status.environment);

  const statCards = [
    { key: "cleared", count: subs.cleared, icon: CheckCircle, color: "text-green-600" },
    { key: "reported", count: subs.reported, icon: CheckCircle, color: "text-green-600" },
    { key: "pending", count: subs.pending, icon: Clock, color: "text-yellow-600" },
    { key: "warning", count: subs.warning, icon: AlertTriangle, color: "text-amber-600" },
    { key: "rejected", count: subs.rejected, icon: XCircle, color: "text-red-600" },
    { key: "failed", count: subs.failed, icon: XCircle, color: "text-red-600" },
  ];

  return (
    <div className="space-y-4">
      {/* Status header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
            {t("zatca.phase2Active")}
          </Badge>
          <Badge variant="outline" className={envBadge.className}>
            {envBadge.label}
          </Badge>
        </div>
      </div>

      {/* Chain lock warning */}
      {chainLocked && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-red-800">Submission Chain Locked</p>
                  <p className="text-xs text-red-600">A clearance request timed out. New submissions are blocked until resolved.</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleResolveLock} disabled={isResolvingLock}>
                {isResolvingLock ? <Loader2 className="h-3 w-3 animate-spin" /> : "Resolve"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Certificate */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              {t("zatca.certificate")}
            </h3>
            <div className="flex items-center gap-2">
              {isExpiringSoon && (
                <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
                  {t("zatca.certificateExpiring")}
                </Badge>
              )}
              {isExpiringSoon && (
                <Button variant="outline" size="sm" onClick={() => setShowRenewDialog(true)}>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  {t("zatca.renewCertificate")}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">{t("zatca.certificateStatus")}</p>
              <p className="font-medium text-slate-900">{cert?.status?.replace(/_/g, " ") || "-"}</p>
            </div>
            <div>
              <p className="text-slate-500">{t("zatca.expiresAt")}</p>
              <p className="font-medium text-slate-900">
                {cert?.expiresAt ? new Date(cert.expiresAt).toLocaleDateString() : "-"}
              </p>
            </div>
            <div>
              <p className="text-slate-500">{t("zatca.issuedOn")}</p>
              <p className="font-medium text-slate-900">
                {cert?.createdAt ? new Date(cert.createdAt).toLocaleDateString() : "-"}
              </p>
            </div>
            <div>
              <p className="text-slate-500">VAT (TRN)</p>
              <p className="font-medium text-slate-900">{status.vatNumber || "-"}</p>
            </div>
          </div>

          {/* Certificate renewal dialog (inline) */}
          {showRenewDialog && (
            <div className="mt-4 p-3 rounded-lg border border-blue-200 bg-blue-50">
              <p className="text-sm font-medium text-blue-800 mb-2">{t("zatca.renewCertificate")}</p>
              <p className="text-xs text-blue-600 mb-3">Enter OTP from ZATCA Fatoora portal to renew your certificate.</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={renewOtp}
                  onChange={(e) => setRenewOtp(e.target.value)}
                  placeholder={t("zatca.otpPlaceholder")}
                  className="flex-1 px-3 py-1.5 text-sm border rounded-md"
                />
                <Button size="sm" onClick={handleRenew} disabled={isRenewing || !renewOtp}>
                  {isRenewing ? <Loader2 className="h-3 w-3 animate-spin" /> : t("zatca.renewCertificate")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowRenewDialog(false); setRenewOtp(""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submission Summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t("zatca.submissionSummary")}
            </h3>
            <span className="text-xs text-slate-500">{totalSubmissions} total</span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {statCards.map(({ key, count, icon: Icon, color }) => (
              <div key={key} className="text-center p-2 rounded-lg bg-slate-50">
                <Icon className={`h-4 w-4 mx-auto mb-1 ${color}`} />
                <p className="text-lg font-bold text-slate-900">{count}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  {t(`zatca.${key}`)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Link href="/settings/zatca-submissions">
              <Button variant="outline" size="sm">
                {t("zatca.viewSubmissions")}
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader className="pb-3">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Settings
          </h3>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-slate-900">{t("zatca.asyncClearance")}</p>
              <p className="text-xs text-slate-500">{t("zatca.asyncClearanceDesc")}</p>
            </div>
            <Switch
              checked={status.clearanceAsync}
              onCheckedChange={toggleAsync}
              disabled={isSaving}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
