"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageAnimation } from "@/components/ui/page-animation";
import { useLanguage } from "@/lib/i18n";
import {
  ArrowLeft, CheckCircle, XCircle, Loader2, ArrowRight, Shield, FileCheck, Zap,
} from "lucide-react";
import { toast } from "sonner";

type StepStatus = "idle" | "loading" | "success" | "error";

interface ComplianceResult {
  label: string;
  status: string;
  errors?: string[];
}

export default function ZatcaOnboardingPage() {
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(1);
  const [stepStatuses, setStepStatuses] = useState<Record<number, StepStatus>>({ 1: "idle", 2: "idle", 3: "idle" });
  const [error, setError] = useState<string | null>(null);

  // Step 1 state
  const [otp, setOtp] = useState("");
  const [branchName, setBranchName] = useState("Main Branch");
  const [deviceId, setDeviceId] = useState("");

  // Step 2 state
  const [complianceResults, setComplianceResults] = useState<ComplianceResult[]>([]);

  // Step 3 state
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const setStepStatus = (step: number, status: StepStatus) => {
    setStepStatuses((prev) => ({ ...prev, [step]: status }));
  };

  // ─── Step 1: Onboard ────────────────────────────────────────────
  const handleOnboard = async () => {
    if (!otp.trim()) { toast.error("OTP is required"); return; }
    setStepStatus(1, "loading");
    setError(null);
    try {
      const res = await fetch("/api/zatca/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp, branchName, egsDeviceId: deviceId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Onboarding failed");
      setStepStatus(1, "success");
      toast.success("Compliance CSID obtained!");
      setCurrentStep(2);
    } catch (e) {
      setStepStatus(1, "error");
      setError(e instanceof Error ? e.message : "Onboarding failed");
    }
  };

  // ─── Step 2: Compliance Check ───────────────────────────────────
  const handleComplianceCheck = async () => {
    setStepStatus(2, "loading");
    setError(null);
    setComplianceResults([]);
    try {
      const res = await fetch("/api/zatca/compliance-check", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Compliance check failed");
      setComplianceResults(data.results || []);
      if (data.success) {
        setStepStatus(2, "success");
        toast.success(t("zatca.allPassed"));
        setCurrentStep(3);
      } else {
        setStepStatus(2, "error");
        setError(t("zatca.someFailed"));
      }
    } catch (e) {
      setStepStatus(2, "error");
      setError(e instanceof Error ? e.message : "Compliance check failed");
    }
  };

  // ─── Step 3: Activate ───────────────────────────────────────────
  const handleActivate = async () => {
    setStepStatus(3, "loading");
    setError(null);
    try {
      const res = await fetch("/api/zatca/activate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Activation failed");
      setStepStatus(3, "success");
      setExpiresAt(data.expiresAt);
      toast.success(t("zatca.activated"));
    } catch (e) {
      setStepStatus(3, "error");
      setError(e instanceof Error ? e.message : "Activation failed");
    }
  };

  const steps = [
    { num: 1, label: t("zatca.step1"), icon: Shield },
    { num: 2, label: t("zatca.step2"), icon: FileCheck },
    { num: 3, label: t("zatca.step3"), icon: Zap },
  ];

  return (
    <PageAnimation>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/settings">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("zatca.onboarding")}</h2>
            <p className="text-sm text-slate-500">{t("zatca.onboardingDesc")}</p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-0">
          {steps.map((step, i) => {
            const status = stepStatuses[step.num];
            const isActive = currentStep === step.num;
            const isDone = status === "success";
            return (
              <div key={step.num} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    isDone ? "bg-green-500 text-white" :
                    isActive ? "bg-primary text-white" :
                    "bg-slate-200 text-slate-500"
                  }`}>
                    {isDone ? <CheckCircle className="h-5 w-5" /> : step.num}
                  </div>
                  <span className={`text-xs mt-1 ${isActive || isDone ? "text-slate-900 font-medium" : "text-slate-400"}`}>
                    {step.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-16 h-0.5 mx-2 mb-4 ${isDone ? "bg-green-500" : "bg-slate-200"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Step 1: Onboard */}
        {currentStep >= 1 && (
          <Card className={stepStatuses[1] === "success" ? "border-green-200 bg-green-50/30" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  {t("zatca.step1")}
                </h3>
                {stepStatuses[1] === "success" && (
                  <Badge variant="outline" className="bg-green-100 text-green-700">{t("zatca.complete")}</Badge>
                )}
              </div>
              <p className="text-xs text-slate-500">{t("zatca.step1Desc")}</p>
            </CardHeader>
            {stepStatuses[1] !== "success" && (
              <CardContent className="pt-0 space-y-4">
                <div>
                  <Label htmlFor="otp">{t("zatca.otp")} *</Label>
                  <Input id="otp" value={otp} onChange={(e) => setOtp(e.target.value)}
                    placeholder={t("zatca.otpPlaceholder")} disabled={stepStatuses[1] === "loading"} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="branch">{t("zatca.branchName")}</Label>
                    <Input id="branch" value={branchName} onChange={(e) => setBranchName(e.target.value)}
                      placeholder={t("zatca.branchNamePlaceholder")} disabled={stepStatuses[1] === "loading"} />
                  </div>
                  <div>
                    <Label htmlFor="device">{t("zatca.deviceId")}</Label>
                    <Input id="device" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}
                      placeholder={t("zatca.deviceIdPlaceholder")} disabled={stepStatuses[1] === "loading"} />
                  </div>
                </div>
                <Button onClick={handleOnboard} disabled={stepStatuses[1] === "loading" || !otp.trim()} className="w-full">
                  {stepStatuses[1] === "loading" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {t("zatca.getComplianceCsid")}
                </Button>
              </CardContent>
            )}
          </Card>
        )}

        {/* Step 2: Compliance Check */}
        {currentStep >= 2 && (
          <Card className={stepStatuses[2] === "success" ? "border-green-200 bg-green-50/30" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <FileCheck className="h-4 w-4" />
                  {t("zatca.step2")}
                </h3>
                {stepStatuses[2] === "success" && (
                  <Badge variant="outline" className="bg-green-100 text-green-700">{t("zatca.complete")}</Badge>
                )}
              </div>
              <p className="text-xs text-slate-500">{t("zatca.step2Desc")}</p>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {complianceResults.length > 0 && (
                <div className="space-y-2">
                  {complianceResults.map((r, i) => (
                    <div key={i} className={`flex items-start gap-2 p-2 rounded text-sm ${
                      r.status === "PASSED" ? "bg-green-50" : "bg-red-50"
                    }`}>
                      {r.status === "PASSED" ? (
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                      )}
                      <div>
                        <span className="font-medium">{r.label}</span>
                        {r.errors?.map((err, j) => (
                          <p key={j} className="text-xs text-red-600 mt-1">{err}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {stepStatuses[2] !== "success" && (
                <Button onClick={handleComplianceCheck} disabled={stepStatuses[2] === "loading"} className="w-full">
                  {stepStatuses[2] === "loading" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {stepStatuses[2] === "loading" ? "Testing 6 invoice types..." : t("zatca.runComplianceCheck")}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Activate */}
        {currentStep >= 3 && (
          <Card className={stepStatuses[3] === "success" ? "border-green-200 bg-green-50/30" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  {t("zatca.step3")}
                </h3>
                {stepStatuses[3] === "success" && (
                  <Badge variant="outline" className="bg-green-100 text-green-700">{t("zatca.complete")}</Badge>
                )}
              </div>
              <p className="text-xs text-slate-500">{t("zatca.step3Desc")}</p>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {stepStatuses[3] === "success" ? (
                <div className="text-center space-y-3">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
                  <p className="text-lg font-semibold text-green-700">{t("zatca.activated")}</p>
                  {expiresAt && (
                    <p className="text-sm text-slate-500">
                      Certificate expires: {new Date(expiresAt).toLocaleDateString()}
                    </p>
                  )}
                  <Link href="/settings">
                    <Button variant="outline" className="mt-2">
                      {t("zatca.goToSettings")}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <Button onClick={handleActivate} disabled={stepStatuses[3] === "loading"} className="w-full">
                  {stepStatuses[3] === "loading" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {t("zatca.activate")}
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </PageAnimation>
  );
}
