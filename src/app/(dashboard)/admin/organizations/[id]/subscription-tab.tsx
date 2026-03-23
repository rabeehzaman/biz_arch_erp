"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Play, CheckCircle2, Ban, Calendar, Save } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";

type SubscriptionData = {
  status: string;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  isExpired: boolean;
  isWarning: boolean;
  daysRemaining: number | null;
};

type LogEntry = {
  id: string;
  previousStatus: string | null;
  newStatus: string;
  previousEndDate: string | null;
  newEndDate: string | null;
  changedBy: string;
  note: string | null;
  createdAt: string;
};

function statusBadge(status: string) {
  switch (status) {
    case "TRIAL":
      return <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100">Trial</Badge>;
    case "ACTIVE":
      return <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>;
    case "EXPIRED":
      return <Badge variant="destructive">Expired</Badge>;
    case "SUSPENDED":
      return <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100">Suspended</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function toDateInputValue(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toISOString().slice(0, 10);
}

export function SubscriptionTab({ organizationId }: { organizationId: string }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Form state
  const [formStatus, setFormStatus] = useState("TRIAL");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const fetchSubscription = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/organizations/${organizationId}/subscription`);
      if (res.ok) {
        const data = await res.json();
        setSubscription(data.subscription);
        setLogs(data.logs || []);
        setFormStatus(data.subscription.status);
        setFormStartDate(toDateInputValue(data.subscription.startDate));
        setFormEndDate(toDateInputValue(data.subscription.endDate));
        setFormNotes(data.subscription.notes || "");
      }
    } catch {
      toast.error(t("subscription.fetchError"));
    } finally {
      setLoading(false);
    }
  }, [organizationId, t]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const updateSubscription = async (overrides?: {
    status?: string;
    startDate?: string | null;
    endDate?: string | null;
    notes?: string | null;
  }) => {
    setSaving(true);
    try {
      const body = {
        status: overrides?.status ?? formStatus,
        startDate: overrides?.startDate !== undefined ? overrides.startDate : (formStartDate || null),
        endDate: overrides?.endDate !== undefined ? overrides.endDate : (formEndDate || null),
        notes: overrides?.notes !== undefined ? overrides.notes : (formNotes || null),
      };

      const res = await fetch(`/api/admin/organizations/${organizationId}/subscription`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(t("subscription.updated"));
        fetchSubscription();
      } else {
        const err = await res.json();
        toast.error(err.error || t("subscription.updateError"));
      }
    } catch {
      toast.error(t("subscription.updateError"));
    } finally {
      setSaving(false);
    }
  };

  const handleStartTrial = () => {
    const now = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 30);
    updateSubscription({
      status: "TRIAL",
      startDate: now.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      notes: "30-day trial started",
    });
  };

  const handleActivate = () => {
    updateSubscription({ status: "ACTIVE" });
  };

  const handleSuspend = () => {
    updateSubscription({ status: "SUSPENDED" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("subscription.currentStatus")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">{t("subscription.status")}</p>
              {subscription && statusBadge(subscription.status)}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">{t("subscription.startDate")}</p>
              <p className="text-sm font-medium">
                {subscription?.startDate
                  ? new Date(subscription.startDate).toLocaleDateString()
                  : t("subscription.notSet")}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">{t("subscription.endDate")}</p>
              <p className="text-sm font-medium">
                {subscription?.endDate
                  ? new Date(subscription.endDate).toLocaleDateString()
                  : t("subscription.noLimit")}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">{t("subscription.daysRemaining")}</p>
              <p className={`text-sm font-semibold ${
                subscription?.isExpired
                  ? "text-red-600"
                  : subscription?.isWarning
                    ? "text-amber-600"
                    : "text-green-600"
              }`}>
                {subscription?.daysRemaining === null
                  ? t("subscription.unlimited")
                  : subscription?.daysRemaining !== undefined && subscription.daysRemaining < 0
                    ? t("subscription.expiredDaysAgo").replace("{days}", String(Math.abs(subscription.daysRemaining)))
                    : subscription?.daysRemaining === 0
                      ? t("subscription.expiresToday")
                      : `${subscription?.daysRemaining} ${t("subscription.days")}`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("subscription.quickActions")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartTrial}
              disabled={saving}
            >
              <Play className="mr-1.5 h-4 w-4" />
              {t("subscription.startTrial")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleActivate}
              disabled={saving}
              className="border-green-200 text-green-700 hover:bg-green-50"
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              {t("subscription.activatePaid")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSuspend}
              disabled={saving}
              className="border-orange-200 text-orange-700 hover:bg-orange-50"
            >
              <Ban className="mr-1.5 h-4 w-4" />
              {t("subscription.suspend")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Manual Edit Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("subscription.manualEdit")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("subscription.status")}</Label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRIAL">{t("subscription.trial")}</SelectItem>
                  <SelectItem value="ACTIVE">{t("subscription.active")}</SelectItem>
                  <SelectItem value="EXPIRED">{t("subscription.expired")}</SelectItem>
                  <SelectItem value="SUSPENDED">{t("subscription.suspended")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div />
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {t("subscription.startDate")}
              </Label>
              <Input
                type="date"
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {t("subscription.endDate")}
              </Label>
              <Input
                type="date"
                value={formEndDate}
                onChange={(e) => setFormEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t("subscription.notes")}</Label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder={t("subscription.notesPlaceholder")}
                rows={2}
              />
            </div>
          </div>
          <Button
            className="mt-4"
            onClick={() => updateSubscription()}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            {t("subscription.saveChanges")}
          </Button>
        </CardContent>
      </Card>

      {/* History */}
      {logs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("subscription.history")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("subscription.date")}</TableHead>
                    <TableHead>{t("subscription.change")}</TableHead>
                    <TableHead>{t("subscription.endDate")}</TableHead>
                    <TableHead>{t("subscription.notes")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">
                        {log.previousStatus ? (
                          <span>
                            {statusBadge(log.previousStatus)}
                            <span className="mx-1.5 text-muted-foreground">&rarr;</span>
                            {statusBadge(log.newStatus)}
                          </span>
                        ) : (
                          statusBadge(log.newStatus)
                        )}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {log.newEndDate
                          ? new Date(log.newEndDate).toLocaleDateString()
                          : t("subscription.noLimit")}
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">
                        {log.note || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
