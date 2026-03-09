"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { PageAnimation } from "@/components/ui/page-animation";
import Image from "next/image";
import { persistLanguagePreference, useLanguage } from "@/lib/i18n";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { lang, setLanguage, tt } = useLanguage();
  const featurePills = [
    tt("Sales Invoices"),
    tt("Purchase Invoices"),
    tt("Customers"),
    tt("Reports"),
  ];
  const workflowItems = [
    { label: tt("Customers"), color: "bg-emerald-500" },
    { label: tt("Suppliers"), color: "bg-sky-500" },
    { label: tt("Inventory"), color: "bg-amber-400" },
    { label: tt("Purchase Invoices"), color: "bg-slate-900" },
  ];
  const chartHeights = [64, 96, 78, 116, 90];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
      } else if (result?.ok) {
        // Force a hard navigation to ensure session is picked up
        window.location.href = "/";
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageAnimation>
      <div
        dir={lang === "ar" ? "rtl" : "ltr"}
        className="relative min-h-screen overflow-hidden bg-[#eef3ea]"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(135deg,#f8fafc_0%,#edf7ef_34%,#fff7ed_100%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.06)_1px,transparent_1px)] [background-size:72px_72px]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(59,130,246,0.16),transparent_24%),radial-gradient(circle_at_78%_82%,rgba(245,158,11,0.24),transparent_30%)]"
        />
        <div aria-hidden="true" className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-emerald-300/45 blur-3xl" />
        <div aria-hidden="true" className="absolute bottom-[-8rem] right-[-6rem] h-96 w-96 rounded-full bg-amber-200/55 blur-3xl" />
        <div aria-hidden="true" className="absolute right-[18%] top-[24%] h-64 w-64 rounded-full bg-sky-200/35 blur-3xl" />
        <div
          aria-hidden="true"
          className="absolute left-[6%] top-[12%] hidden h-[32rem] w-[32rem] rounded-[3rem] border border-white/60 bg-white/30 shadow-[0_30px_90px_-40px_rgba(15,23,42,0.4)] backdrop-blur-2xl lg:block"
          style={{ transform: "rotate(-14deg)" }}
        />
        <div
          aria-hidden="true"
          className="absolute left-[20%] top-[18%] hidden h-[28rem] w-[24rem] rounded-[2.75rem] border border-white/40 bg-gradient-to-br from-white/50 via-white/10 to-transparent lg:block"
          style={{ transform: "rotate(-4deg)" }}
        />
        <div
          aria-hidden="true"
          className="absolute right-[10%] top-[10%] hidden h-[22rem] w-[18rem] rounded-[2.5rem] border border-white/50 bg-white/20 backdrop-blur-xl lg:block"
          style={{ transform: "rotate(10deg)" }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(115deg,transparent_20%,rgba(255,255,255,0.42)_46%,transparent_70%)]"
        />
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/55 to-transparent" />
        <div className="absolute inset-x-4 top-4 z-20 flex justify-end">
          <div className="inline-flex overflow-hidden rounded-lg border border-white/40 bg-white/80 shadow-sm backdrop-blur">
            <button
              type="button"
              onClick={() => {
                setLanguage("en");
                persistLanguagePreference("en");
              }}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                lang === "en"
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-white"
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => {
                setLanguage("ar");
                persistLanguagePreference("ar");
              }}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                lang === "ar"
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-white"
              }`}
            >
              العربية
            </button>
          </div>
        </div>
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,1fr)_28rem]">
            <div className="hidden lg:block">
              <div className="max-w-xl">
                <div className="inline-flex items-center gap-3 rounded-full border border-white/70 bg-white/65 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-xl">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-950/5">
                    <Image
                      src="/logo.png"
                      alt="BizArch Logo"
                      width={28}
                      height={28}
                      className="h-7 w-7 object-contain"
                      priority
                    />
                  </div>
                  <span>{tt("BizArch ERP")}</span>
                </div>
                <h1 className="mt-8 font-heading text-5xl font-semibold leading-[1.02] text-slate-950">
                  {tt("BizArch ERP")}
                </h1>
                <p className="mt-5 max-w-lg text-lg leading-8 text-slate-700">
                  {tt("Simple invoicing and customer management")}
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  {featurePills.map((pill) => (
                    <span
                      key={pill}
                      className="rounded-full border border-white/70 bg-white/55 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-xl"
                    >
                      {pill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-10 grid max-w-2xl gap-4 xl:grid-cols-2">
                <div className="rounded-[2rem] border border-white/70 bg-white/55 p-6 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.35)] backdrop-blur-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">
                      {tt("Reports")}
                    </span>
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </div>
                  <div className="mt-6 flex h-32 items-end gap-3">
                    {chartHeights.map((height, index) => (
                      <div
                        key={height}
                        className={`flex-1 rounded-t-[1.25rem] bg-gradient-to-t ${
                          index === chartHeights.length - 1
                            ? "from-slate-950 via-slate-900 to-emerald-400"
                            : "from-emerald-500 via-emerald-400 to-emerald-200"
                        }`}
                        style={{ height }}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-[2rem] border border-white/70 bg-white/50 p-6 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.35)] backdrop-blur-2xl xl:translate-y-8">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">
                      {tt("Sales Invoices")}
                    </span>
                    <span className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-medium text-white">
                      {tt("Customers")}
                    </span>
                  </div>
                  <div className="mt-5 space-y-3">
                    {workflowItems.map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between rounded-[1.25rem] border border-white/70 bg-white/75 px-4 py-3 shadow-sm"
                      >
                        <span className="text-sm font-medium text-slate-800">
                          {item.label}
                        </span>
                        <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <Card className="relative w-full max-w-md overflow-hidden rounded-[2rem] border-white/60 bg-white/78 py-0 shadow-[0_28px_90px_-28px_rgba(15,23,42,0.45)] backdrop-blur-2xl supports-[backdrop-filter]:bg-white/72">
              <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-sky-400 to-amber-300" />
              <CardHeader className="space-y-1 pt-8 text-center">
                <div className="mb-6 flex justify-center">
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-[1.25rem] bg-white shadow-[0_18px_40px_-22px_rgba(15,23,42,0.45)]">
                    <Image
                      src="/logo.png"
                      alt="BizArch Logo"
                      width={80}
                      height={80}
                      className="object-contain"
                      priority
                    />
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold">
                  {tt("BizArch ERP")}
                </CardTitle>
                <CardDescription className="text-sm leading-6 text-slate-600">
                  {tt("Enter your credentials to access your account")}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-8">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50/90 p-3 text-sm text-red-600">
                      {error}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">{tt("Email")}</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@bizarch.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-11 rounded-xl border-white/70 bg-white/75 shadow-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">{tt("Password")}</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder={tt("Enter your password")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-11 rounded-xl border-white/70 bg-white/75 shadow-sm"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="h-11 w-full rounded-xl bg-slate-950 shadow-lg shadow-slate-950/15 hover:bg-slate-800"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {tt("Signing in...")}
                      </>
                    ) : (
                      tt("Sign In")
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageAnimation>
  );
}
