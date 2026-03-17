"use client";

import whatsNewData from "@/data/whats-new.json";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageAnimation } from "@/components/ui/page-animation";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import {
  Sparkles,
  Bug,
  Zap,
  Wrench,
  Calendar,
  Tag,
} from "lucide-react";

type EntryType = "feature" | "fix" | "improvement" | "chore";

interface WhatsNewEntry {
  type: EntryType;
  scope?: string;
  title: string;
  description?: string;
}

interface WhatsNewVersion {
  version: string;
  date: string;
  lastCommit: string;
  entries: WhatsNewEntry[];
}

const typeConfig: Record<
  EntryType,
  { label: string; labelAr: string; icon: typeof Sparkles; className: string }
> = {
  feature: {
    label: "New",
    labelAr: "جديد",
    icon: Sparkles,
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  },
  fix: {
    label: "Fix",
    labelAr: "إصلاح",
    icon: Bug,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  improvement: {
    label: "Improved",
    labelAr: "تحسين",
    icon: Zap,
    className:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300",
  },
  chore: {
    label: "Maintenance",
    labelAr: "صيانة",
    icon: Wrench,
    className:
      "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400",
  },
};

function formatDate(dateStr: string, isArabic: boolean) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString(isArabic ? "ar-SA" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function WhatsNewPage() {
  const { t, isRTL } = useLanguage();
  const versions = whatsNewData as WhatsNewVersion[];

  // Count totals
  const totalFeatures = versions.reduce(
    (sum, v) => sum + v.entries.filter((e) => e.type === "feature").length,
    0
  );
  const totalFixes = versions.reduce(
    (sum, v) => sum + v.entries.filter((e) => e.type === "fix").length,
    0
  );

  return (
    <PageAnimation>
      <div className="mx-auto max-w-4xl space-y-8 p-4 md:p-6">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/20">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                {t("whatsNew.title")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t("whatsNew.subtitle")}
              </p>
            </div>
          </div>

          {/* Summary stats */}
          <div className="flex gap-4">
            <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
              <Sparkles className="h-4 w-4 text-blue-500" />
              <span className="font-medium">{totalFeatures}</span>
              <span className="text-muted-foreground">
                {t("whatsNew.features")}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
              <Bug className="h-4 w-4 text-emerald-500" />
              <span className="font-medium">{totalFixes}</span>
              <span className="text-muted-foreground">
                {t("whatsNew.fixes")}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
              <Calendar className="h-4 w-4 text-slate-500" />
              <span className="font-medium">{versions.length}</span>
              <span className="text-muted-foreground">
                {t("whatsNew.releases")}
              </span>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="relative space-y-6">
          {/* Timeline line */}
          <div
            className={cn(
              "absolute top-6 bottom-6 w-px bg-border",
              isRTL ? "right-[7px]" : "left-[7px]"
            )}
          />

          {versions.map((version, vIdx) => (
            <div
              key={version.version}
              className={cn("relative", isRTL ? "pr-8" : "pl-8")}
            >
              {/* Timeline dot */}
              <div
                className={cn(
                  "absolute top-6 h-[15px] w-[15px] rounded-full border-[3px] border-background shadow-sm",
                  vIdx === 0
                    ? "bg-gradient-to-br from-amber-400 to-orange-500"
                    : "bg-muted-foreground/40",
                  isRTL ? "right-0" : "left-0"
                )}
              />

              <Card
                className={cn(
                  "overflow-hidden transition-shadow hover:shadow-md",
                  vIdx === 0 && "ring-1 ring-amber-200 dark:ring-amber-900"
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(version.date, isRTL)}</span>
                    </div>
                    {vIdx === 0 && (
                      <Badge className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        {t("whatsNew.latest")}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {version.entries.map((entry, eIdx) => {
                    const config = typeConfig[entry.type as EntryType] || typeConfig.improvement;
                    const Icon = config.icon;
                    return (
                      <div
                        key={eIdx}
                        className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50"
                      >
                        <Badge
                          variant="outline"
                          className={cn(
                            "mt-0.5 shrink-0 rounded-md text-[10px]",
                            config.className
                          )}
                        >
                          <Icon className="!h-3 !w-3" />
                          {isRTL ? config.labelAr : config.label}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-snug">
                            {entry.title}
                          </p>
                          {entry.description && (
                            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                              {entry.description}
                            </p>
                          )}
                          {entry.scope && (
                            <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground/70">
                              <Tag className="h-3 w-3" />
                              {entry.scope}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </PageAnimation>
  );
}
