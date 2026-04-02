"use client";

import { useSearchParams } from "next/navigation";
import { PriceListForm } from "@/components/price-lists/price-list-form";

export default function NewPriceListPage() {
  const searchParams = useSearchParams();
  const duplicateId = searchParams.get("duplicate");

  return <PriceListForm duplicateId={duplicateId || undefined} />;
}
