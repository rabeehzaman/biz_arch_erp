"use client";

import { useState, useCallback, useRef, useEffect } from "react";

const DEFAULT_LIMIT = 50;

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  hasMore: boolean;
}

interface UseInfiniteListOptions {
  /** Base API URL, e.g. "/api/invoices" */
  url: string;
  /** Number of items per page (default 50) */
  limit?: number;
  /** Extra query params to append, e.g. { status: "draft" } */
  params?: Record<string, string>;
}

interface UseInfiniteListReturn<T> {
  items: T[];
  total: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  loadMore: () => void;
  /** Re-fetch from scratch (e.g. after create/delete) */
  refresh: () => void;
}

export function useInfiniteList<T>(
  options: UseInfiniteListOptions
): UseInfiniteListReturn<T> {
  const { url, limit = DEFAULT_LIMIT, params } = options;

  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [searchQuery, setSearchQueryState] = useState("");

  // Use ref to track the latest search for debouncing
  const searchRef = useRef(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const offsetRef = useRef(0);
  const abortRef = useRef<AbortController>(undefined);

  const buildUrl = useCallback(
    (offset: number, search: string) => {
      const qp = new URLSearchParams();
      qp.set("limit", String(limit));
      qp.set("offset", String(offset));
      if (search) qp.set("search", search);
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (v) qp.set(k, v);
        });
      }
      return `${url}?${qp.toString()}`;
    },
    [url, limit, params]
  );

  const fetchPage = useCallback(
    async (offset: number, search: string, append: boolean) => {
      // Cancel any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(buildUrl(offset, search), {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to fetch");
        const json: PaginatedResponse<T> = await res.json();

        if (append) {
          setItems((prev) => [...prev, ...json.data]);
        } else {
          setItems(json.data);
        }
        setTotal(json.total);
        setHasMore(json.hasMore);
        offsetRef.current = offset + json.data.length;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("Failed to fetch list:", err);
      }
    },
    [buildUrl]
  );

  // Initial load + reload when params change
  useEffect(() => {
    offsetRef.current = 0;
    setIsLoading(true);
    fetchPage(0, searchRef.current, false).finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, limit, JSON.stringify(params)]);

  const setSearchQuery = useCallback(
    (q: string) => {
      setSearchQueryState(q);
      searchRef.current = q;

      // Debounce search requests
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        offsetRef.current = 0;
        setIsLoading(true);
        fetchPage(0, q, false).finally(() => setIsLoading(false));
      }, 300);
    },
    [fetchPage]
  );

  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    fetchPage(offsetRef.current, searchRef.current, true).finally(() =>
      setIsLoadingMore(false)
    );
  }, [isLoadingMore, hasMore, fetchPage]);

  const refresh = useCallback(() => {
    offsetRef.current = 0;
    setIsLoading(true);
    fetchPage(0, searchRef.current, false).finally(() => setIsLoading(false));
  }, [fetchPage]);

  return {
    items,
    total,
    isLoading,
    isLoadingMore,
    hasMore,
    searchQuery,
    setSearchQuery,
    loadMore,
    refresh,
  };
}
