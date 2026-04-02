"use client";

import { use } from "react";
import { PriceListForm } from "@/components/price-lists/price-list-form";

export default function EditPriceListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return <PriceListForm priceListId={id} />;
}
