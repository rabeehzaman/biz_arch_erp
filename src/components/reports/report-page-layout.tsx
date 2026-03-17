"use client";

import { Card, CardContent } from "@/components/ui/card";
import { PageAnimation } from "@/components/ui/page-animation";
import { useLanguage } from "@/lib/i18n";
import { ReactNode } from "react";

interface ReportPageLayoutProps {
  titleKey: string;
  descriptionKey: string;
  filterBar: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  isLoading: boolean;
}

export function ReportPageLayout({
  titleKey,
  descriptionKey,
  filterBar,
  actions,
  children,
  isLoading,
}: ReportPageLayoutProps) {
  const { t } = useLanguage();

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t(titleKey)}</h2>
            <p className="text-slate-500">{t(descriptionKey)}</p>
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>

        <Card>
          <CardContent className="p-4 sm:p-6">{filterBar}</CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          children
        )}
      </div>
    </PageAnimation>
  );
}
