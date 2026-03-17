"use client";

import { CashBankBookView } from "@/components/reports/cash-bank-book-view";
import { Suspense } from "react";

function CashBookContent() {
  return <CashBankBookView bookType="cash" />;
}

export default function CashBookPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    }>
      <CashBookContent />
    </Suspense>
  );
}
