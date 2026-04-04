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
  const { lang, setLanguage, t, tt } = useLanguage();
  const featurePills = [
    tt("Sales Invoices"),
    tt("Purchase Invoices"),
    tt("Customers"),
    tt("Reports"),
  ];
  const workflowItems = [
    { label: tt("Customers"), color: "bg-sky-400" },
    { label: tt("Suppliers"), color: "bg-cyan-400" },
    { label: tt("Inventory"), color: "bg-green-300" },
    { label: tt("Purchase Invoices"), color: "bg-blue-900" },
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
        setError(t("login.invalidCredentials"));
      } else if (result?.ok) {
        // Force a hard navigation to ensure session is picked up
        window.location.href = "/";
      }
    } catch {
      setError(t("login.genericError"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageAnimation>
      <div
        dir={lang === "ar" ? "rtl" : "ltr"}
        className="relative min-h-[100svh] overflow-hidden bg-slate-100 lg:h-[100svh]"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(180deg,#f8fafc_0%,#eef4f8_100%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.06)_1px,transparent_1px)] [background-size:56px_56px]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(14,165,233,0.12),rgba(248,250,252,0))]"
        />
        <div className="absolute inset-x-4 z-20 flex justify-end" style={{ top: "calc(1rem + var(--app-safe-area-top))" }}>
          <div className="inline-flex overflow-hidden rounded-full border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => {
                setLanguage("en");
                persistLanguagePreference("en");
              }}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                lang === "en"
                  ? "bg-primary text-white"
                  : "text-slate-700 hover:bg-slate-50"
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
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                lang === "ar"
                  ? "bg-primary text-white"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              العربية
            </button>
          </div>
        </div>
        <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-7xl items-center px-4 py-8 sm:px-6 lg:h-[100svh] lg:px-8 lg:py-5 xl:py-8">
          <div className="grid w-full items-center gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_26rem] 2xl:grid-cols-[minmax(0,1fr)_28rem] 2xl:gap-10">
            <div className="hidden lg:flex lg:min-h-0 lg:flex-col lg:justify-center">
              <div className="max-w-xl">
                <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm xl:px-4 xl:py-2 xl:text-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-100 xl:h-9 xl:w-9">
                    <Image
                      src="/bizarch-mark.svg"
                      alt="BizArch Logo"
                      width={28}
                      height={28}
                      className="h-6 w-6 object-contain xl:h-7 xl:w-7"
                      priority
                    />
                  </div>
                  <span>{tt("BizArch ERP")}</span>
                </div>
                <div className="mt-5 max-w-[18rem] xl:mt-7 xl:max-w-[22rem] 2xl:max-w-[26rem]">
                  <Image
                    src="/bizarch-logo.svg"
                    alt="BizArch Systems Architecture Innovation"
                    width={440}
                    height={440}
                    className="h-auto w-full"
                    priority
                  />
                </div>
                <p className="mt-3 max-w-lg text-base leading-7 text-slate-700 xl:mt-5 xl:text-lg xl:leading-8">
                  {tt("Simple invoicing and customer management")}
                </p>
                <div className="mt-5 flex flex-wrap gap-2 xl:mt-7 xl:gap-3">
                  {featurePills.map((pill) => (
                    <span
                      key={pill}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm xl:px-4 xl:py-2 xl:text-sm"
                    >
                      {pill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 hidden max-w-2xl gap-4 [@media(min-width:1280px)_and_(min-height:860px)]:grid [@media(min-width:1280px)_and_(min-height:860px)]:grid-cols-2">
                <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">
                      {tt("Reports")}
                    </span>
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </div>
                  <div className="mt-5 flex h-28 items-end gap-3">
                    {chartHeights.map((height, index) => (
                      <div
                        key={height}
                        className={`flex-1 rounded-t-[1.25rem] ${
                          index === chartHeights.length - 1
                            ? "bg-slate-900"
                            : "bg-sky-500"
                        }`}
                        style={{ height }}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">
                      {tt("Sales Invoices")}
                    </span>
                    <span className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-medium text-white">
                      {tt("Customers")}
                    </span>
                  </div>
                  <div className="mt-4 space-y-2.5">
                    {workflowItems.map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-2.5"
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

            <Card className="relative w-full max-w-md overflow-hidden rounded-[2rem] py-0 shadow-sm lg:max-w-[24rem] xl:max-w-md">
              <div className="h-1.5 w-full bg-primary" />
              <CardHeader className="space-y-1 pt-6 text-center xl:pt-8">
                <div className="mb-4 flex justify-center xl:mb-6">
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-[1.1rem] border border-slate-200 bg-white xl:h-20 xl:w-20 xl:rounded-[1.25rem]">
                    <Image
                      src="/bizarch-mark.svg"
                      alt="BizArch Logo"
                      width={80}
                      height={80}
                      className="h-12 w-12 object-contain xl:h-16 xl:w-16"
                      priority
                    />
                  </div>
                </div>
                <CardTitle className="text-xl font-bold xl:text-2xl">
                  {tt("BizArch ERP")}
                </CardTitle>
                <CardDescription className="text-sm leading-5 text-slate-600 xl:leading-6">
                  {tt("Enter your credentials to access your account")}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-6 xl:pb-8">
                <form onSubmit={handleSubmit} className="space-y-3 xl:space-y-4">
                  {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50/90 p-2.5 text-sm text-red-600">
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
                      className="h-10 rounded-xl border-slate-200 bg-white xl:h-11"
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
                      className="h-10 rounded-xl border-slate-200 bg-white xl:h-11"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="h-10 w-full xl:h-11"
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
