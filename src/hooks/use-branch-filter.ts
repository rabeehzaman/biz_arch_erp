"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface Branch {
  id: string;
  name: string;
  code: string;
}

export function useBranchFilter() {
  const { data: session } = useSession();
  const multiBranchEnabled = !!(session?.user as any)?.multiBranchEnabled;
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filterBranchId, setFilterBranchId] = useState("all");

  useEffect(() => {
    if (!multiBranchEnabled) return;
    fetch("/api/branches")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setBranches(data))
      .catch(() => setBranches([]));
  }, [multiBranchEnabled]);

  const branchParam = filterBranchId === "all" ? undefined : filterBranchId;

  return {
    branches,
    filterBranchId,
    setFilterBranchId,
    multiBranchEnabled,
    branchParam,
  };
}
