import { useState, useEffect, useCallback } from "react";

export interface GoldRateEntry {
  id: string;
  purity: string;
  metalType: string;
  sellRate: number;
  buyRate: number;
}

/**
 * Hook to fetch today's gold rates for jewellery-enabled orgs.
 * Returns a rate map keyed by "PURITY|METALTYPE" for fast lookup.
 */
export function useJewelleryRates(enabled: boolean) {
  const [rates, setRates] = useState<GoldRateEntry[]>([]);
  const [rateMap, setRateMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);

  const fetchRates = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await fetch("/api/jewellery/gold-rates/today");
      if (res.ok) {
        const data = await res.json();
        const entries: GoldRateEntry[] = Array.isArray(data) ? data : data.rates || [];
        setRates(entries);
        const map = new Map<string, number>();
        for (const r of entries) {
          map.set(`${r.purity}|${r.metalType}`, Number(r.sellRate));
        }
        setRateMap(map);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  const getRate = useCallback(
    (purity: string, metalType: string = "GOLD"): number => {
      return rateMap.get(`${purity}|${metalType}`) || 0;
    },
    [rateMap]
  );

  return { rates, rateMap, getRate, loading, refetch: fetchRates };
}
