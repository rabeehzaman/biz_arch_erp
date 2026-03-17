"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { getEditionConfig, type EditionConfig, type EditionId } from "@/lib/edition";

export function useEdition(): { edition: EditionId; config: EditionConfig } {
  const { data: session } = useSession();
  const user = session?.user as { edition?: string; saudiEInvoiceEnabled?: boolean; currency?: string } | undefined;

  // Derive edition from existing flags when session doesn't have edition yet (pre-migration sessions)
  const edition = user?.edition
    || (user?.saudiEInvoiceEnabled || user?.currency === "SAR" ? "SAUDI" : "INDIA");

  return useMemo(() => ({
    edition: edition as EditionId,
    config: getEditionConfig(edition),
  }), [edition]);
}
