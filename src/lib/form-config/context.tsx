"use client";

import { createContext, type ReactNode } from "react";
import useSWR from "swr";
import type { OrgFormConfig } from "./types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export const FormConfigContext = createContext<OrgFormConfig | null>(null);

export function FormConfigProvider({ children }: { children: ReactNode }) {
  const { data } = useSWR<OrgFormConfig>("/api/form-config", fetcher);

  return (
    <FormConfigContext.Provider value={data ?? null}>
      {children}
    </FormConfigContext.Provider>
  );
}
