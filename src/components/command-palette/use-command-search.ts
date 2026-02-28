"use client";

import { useState, useEffect, useRef } from "react";
import type { SearchResults } from "./types";

const DEBOUNCE_MS = 300;

export function useCommandSearch(
  query: string,
  enabled: boolean,
  isMobileShopEnabled: boolean
) {
  const [results, setResults] = useState<SearchResults>({});
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || query.trim().length < 2) {
      setResults({});
      setLoading(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      setLoading(true);
      try {
        const lq = query.trim().toLowerCase();

        const fetchJson = (url: string) =>
          fetch(url, { signal })
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => []);

        const endpoints: Promise<unknown>[] = [
          fetchJson("/api/products"),
          fetchJson("/api/customers"),
          fetchJson("/api/suppliers"),
          fetchJson("/api/invoices"),
          fetchJson("/api/purchase-invoices"),
        ];

        if (isMobileShopEnabled) {
          endpoints.push(fetchJson(`/api/mobile-devices?search=${encodeURIComponent(query.trim())}`));
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = (await Promise.all(endpoints)) as any[];

        if (signal.aborted) return;

        const [rawProducts, rawCustomers, rawSuppliers, rawInvoices, rawPurchaseInvoices, rawDevices] = raw;

        type P = { name?: string; sku?: string; barcode?: string };
        type C = { name?: string; email?: string; phone?: string };
        type S = { name?: string; email?: string; phone?: string };
        type I = { invoiceNumber?: string; customer?: { name?: string } };
        type PI = { purchaseInvoiceNumber?: string; supplier?: { name?: string } };

        const toArr = (v: unknown) => (Array.isArray(v) ? v : []);

        const products = toArr(Array.isArray(rawProducts) ? rawProducts : rawProducts?.products)
          .filter((p: P) =>
            p.name?.toLowerCase().includes(lq) ||
            p.sku?.toLowerCase().includes(lq) ||
            p.barcode?.toLowerCase().includes(lq)
          )
          .slice(0, 5);

        const customers = toArr(Array.isArray(rawCustomers) ? rawCustomers : rawCustomers?.customers)
          .filter((c: C) =>
            c.name?.toLowerCase().includes(lq) ||
            c.email?.toLowerCase().includes(lq) ||
            c.phone?.includes(query.trim())
          )
          .slice(0, 5);

        const suppliers = toArr(Array.isArray(rawSuppliers) ? rawSuppliers : rawSuppliers?.suppliers)
          .filter((s: S) =>
            s.name?.toLowerCase().includes(lq) ||
            s.email?.toLowerCase().includes(lq) ||
            s.phone?.includes(query.trim())
          )
          .slice(0, 5);

        const invoices = toArr(Array.isArray(rawInvoices) ? rawInvoices : rawInvoices?.invoices)
          .filter((i: I) =>
            i.invoiceNumber?.toLowerCase().includes(lq) ||
            i.customer?.name?.toLowerCase().includes(lq)
          )
          .slice(0, 5);

        const purchaseInvoices = toArr(Array.isArray(rawPurchaseInvoices) ? rawPurchaseInvoices : rawPurchaseInvoices?.purchaseInvoices)
          .filter((i: PI) =>
            i.purchaseInvoiceNumber?.toLowerCase().includes(lq) ||
            i.supplier?.name?.toLowerCase().includes(lq)
          )
          .slice(0, 5);

        const devices = isMobileShopEnabled
          ? toArr(Array.isArray(rawDevices) ? rawDevices : rawDevices?.devices).slice(0, 5)
          : [];

        setResults({ products, customers, suppliers, invoices, purchaseInvoices, devices });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setResults({});
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, enabled, isMobileShopEnabled]);

  return { results, loading };
}
