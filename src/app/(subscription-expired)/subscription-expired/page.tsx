"use client";

import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShieldAlert, LogOut, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useRouter } from "next/navigation";

export default function SubscriptionExpiredPage() {
  const { data: session, status } = useSession();
  const { t } = useLanguage();
  const router = useRouter();
  const [subInfo, setSubInfo] = useState<{
    status: string;
    endDate: string | null;
    orgName: string;
  } | null>(null);

  // Superadmin should never see this page
  useEffect(() => {
    if (
      status === "authenticated" &&
      (session?.user as { role?: string })?.role === "superadmin"
    ) {
      router.replace("/admin/organizations");
    }
  }, [status, session, router]);

  // Fetch subscription info
  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/subscription/status")
        .then((r) => r.json())
        .then((data) => {
          // If not actually expired, redirect back to dashboard
          if (!data.isExpired) {
            router.replace("/");
            return;
          }
          setSubInfo(data);
        })
        .catch(() => {});
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.replace("/login");
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <ShieldAlert className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-xl">
            {t("subscription.expiredTitle")}
          </CardTitle>
          <CardDescription className="text-base">
            {t("subscription.expiredMessage")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {subInfo && (
            <div className="rounded-lg bg-slate-100 p-4 text-sm space-y-1.5">
              {subInfo.orgName && (
                <p>
                  <span className="font-medium text-muted-foreground">
                    {t("subscription.organization")}:
                  </span>{" "}
                  {subInfo.orgName}
                </p>
              )}
              <p>
                <span className="font-medium text-muted-foreground">
                  {t("subscription.status")}:
                </span>{" "}
                <span className="font-semibold text-red-600">
                  {subInfo.status === "EXPIRED"
                    ? t("subscription.expired")
                    : subInfo.status === "SUSPENDED"
                      ? t("subscription.suspended")
                      : t("subscription.expired")}
                </span>
              </p>
              {subInfo.endDate && (
                <p>
                  <span className="font-medium text-muted-foreground">
                    {t("subscription.expiredOn")}:
                  </span>{" "}
                  {new Date(subInfo.endDate).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          <p className="text-center text-sm text-muted-foreground">
            {t("subscription.contactAdmin")}
          </p>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t("subscription.logout")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
