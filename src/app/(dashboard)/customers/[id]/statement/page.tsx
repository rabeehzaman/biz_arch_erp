"use client";

import { use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PageAnimation } from "@/components/ui/page-animation";
import { useLanguage } from "@/lib/i18n";
import { CustomerStatementTab } from "@/components/customers/detail/customer-statement-tab";

export default function CustomerStatementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useLanguage();

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Link href={`/customers/${id}`}>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-slate-900">
              {t("statement.customerStatement")}
            </h2>
          </div>
        </div>
        <CustomerStatementTab customerId={id} />
      </div>
    </PageAnimation>
  );
}
